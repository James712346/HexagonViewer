import initSqlJs, { Database } from "sql.js";
import sqliteUrl from "../assets/sql-wasm.wasm?url";
import { clearAllCache } from "./pdf.ts";

const DB_NAME = "hexagon-database";
const DB_VERSION = 1;
const STORE_NAME = "databases";
const DATABASE_KEY = "main-database";

// Initialize IndexedDB
function openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

// Save database to IndexedDB
export async function saveDatabase(db: Database): Promise<void> {
    try {
        const binaryArray = db.export();
        const indexedDB = await openIndexedDB();
        
        const transaction = indexedDB.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise<void>((resolve, reject) => {
            const request = store.put(binaryArray, DATABASE_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        indexedDB.close();
        console.log("Database saved to IndexedDB.");
    } catch (error) {
        console.error("Error saving database to IndexedDB:", error);
        throw error;
    }
}

// Load database from IndexedDB
export async function loadDatabaseFromIndexedDB(): Promise<Uint8Array | null> {
    try {
        const indexedDB = await openIndexedDB();
        
        const transaction = indexedDB.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        
        const binaryArray = await new Promise<Uint8Array | null>((resolve, reject) => {
            const request = store.get(DATABASE_KEY);
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? new Uint8Array(result) : null);
            };
            request.onerror = () => reject(request.error);
        });
        
        indexedDB.close();
        return binaryArray;
    } catch (error) {
        console.error("Error loading database from IndexedDB:", error);
        return null;
    }
}

// Check and get database from IndexedDB
export async function checkGetDatabase(
    setDatabase: ((db: Database|null) => void ),
): Promise<void> {
    try {
        const binaryArray = await loadDatabaseFromIndexedDB();
        
        if (!binaryArray) {
            console.log("No saved database found in IndexedDB.");
            return;
        }
        
        const SQL = await initSqlJs({ locateFile: () => sqliteUrl });
        const db = new SQL.Database(binaryArray);
        setDatabase(db);
        console.log("Database loaded from IndexedDB.");
    } catch (error) {
        console.error("Error loading database from IndexedDB:", error);
    }
}

// Initialize database from file input
export async function initializeDatabase(
    setDatabase:  ((db: Database|null) => void ),
): Promise<void> {
    try {
        const fileElement = document.getElementById(
            "fileInput",
        ) as HTMLInputElement;
        
        if (fileElement?.files?.length) {
            const file = fileElement.files[0];
            const SQL = await initSqlJs({ locateFile: () => sqliteUrl });
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
                    const data = new Uint8Array(arrayBuffer);
                    const db = new SQL.Database(data);
                    setDatabase(db);
                    await saveDatabase(db);
                } catch (error) {
                    console.error("Error processing uploaded file:", error);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.log(`An error occurred: ${error.message}`);
        } else if (typeof error === "string") {
            console.log(error);
        } else {
            console.log("An unknown error occurred " + error);
        }
    }
}

// Clear database from IndexedDB
export async function clearDatabaseStorage(setDatabase:((db: Database|null) => void)): Promise<void> {
    try {
        const indexedDB = await openIndexedDB();
        
        const transaction = indexedDB.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise<void>((resolve, reject) => {
            const request = store.delete(DATABASE_KEY);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        indexedDB.close();
        await clearAllCache();
        setDatabase(null);
        console.log("Database cleared from IndexedDB.");
    } catch (error) {
        console.error("Error clearing database from IndexedDB:", error);
    }
}

// Download database (unchanged from your original)
export function downloadDatabase(
    db: Database,
    filename = "database.sqlite",
): void {
    try {
        const binaryArray = db.export();
        const blob = new Blob([binaryArray], {
            type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Database download triggered.");
    } catch (error) {
        console.error("Error downloading database:", error);
    }
}

// Utility function to get storage usage information
export async function getStorageInfo(): Promise<{
    usage: number;
    quota: number;
    usagePercentage: number;
}> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const usagePercentage = quota > 0 ? (usage / quota) * 100 : 0;
        
        return {
            usage,
            quota,
            usagePercentage
        };
    }
    
    return {
        usage: 0,
        quota: 0,
        usagePercentage: 0
    };
}

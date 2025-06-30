import {
    getDocument,
    GlobalWorkerOptions,
    PDFDocumentProxy,
    version,
} from "pdfjs-dist";

// Ensure worker is configured
GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

// Cache configuration
const CACHE_DB_NAME = "pdf-image-cache";
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = "pdf-images";

// Types
export interface PdfImageData {
    blob: Blob;
    dimensions: { width: number; height: number };
    url?: string;
}

interface CacheEntry {
    blob: Blob;
    dimensions: { width: number; height: number };
    timestamp: number;
}

// Initialize IndexedDB for PDF image caching
function openCacheDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
                const store = db.createObjectStore(CACHE_STORE_NAME);
                // Create an index for timestamp-based cleanup
                store.createIndex("timestamp", "timestamp", { unique: false });
            }
        };
    });
}

// Generate cache key from PDF data
export function generateCacheKey(pdfData: string, scale: number): string {
    // Create a simple hash of the PDF data + scale for caching
    let hash = 0;
    const str = pdfData + scale.toString();
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
}

// Save image blob to cache
export async function saveBlobToCache(
    cacheKey: string, 
    blob: Blob, 
    dimensions: { width: number; height: number }
): Promise<void> {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CACHE_STORE_NAME], "readwrite");
        const store = transaction.objectStore(CACHE_STORE_NAME);
        
        const cacheData: CacheEntry = {
            blob,
            dimensions,
            timestamp: Date.now()
        };
        
        await new Promise<void>((resolve, reject) => {
            const request = store.put(cacheData, cacheKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        db.close();
        console.log("PDF image cached successfully");
    } catch (error) {
        console.error("Error saving blob to cache:", error);
        throw error;
    }
}

// Load image blob from cache
export async function loadBlobFromCache(cacheKey: string): Promise<PdfImageData | null> {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CACHE_STORE_NAME], "readonly");
        const store = transaction.objectStore(CACHE_STORE_NAME);
        
        const result = await new Promise<CacheEntry | null>((resolve, reject) => {
            const request = store.get(cacheKey);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
        
        db.close();
        
        if (result && result.blob) {
            return {
                blob: result.blob,
                dimensions: result.dimensions,
                url: URL.createObjectURL(result.blob)
            };
        }
        
        return null;
    } catch (error) {
        console.error("Error loading blob from cache:", error);
        return null;
    }
}

// Render PDF to image blob
export async function renderPdfToBlob(
    pdfData: string, 
    scale: number = 2,
    quality: number = 0.9
): Promise<PdfImageData> {
    return new Promise((resolve, reject) => {
        const convertPdfToImage = async () => {
            try {
                // Create a temporary canvas for rendering
                let tempCanvas = document.createElement("canvas");
                const tempContext = tempCanvas.getContext("2d", {
                    alpha: false, // Major performance boost
                    desynchronized: true, // Reduces input latency
                    willReadFrequently: false, // Optimizes for write-only
                    powerPreference: "high-performance",
                });

                if (!tempContext) {
                    throw new Error("Could not get canvas context");
                }

                const loadingTask = getDocument({ data: atob(pdfData) });
                const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
                const pageNumber = 1;
                const page = await pdfDoc.getPage(pageNumber);
                const viewport = page.getViewport({ scale });

                // Set canvas dimensions
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;

                // Render PDF to canvas
                const renderContext = {
                    canvasContext: tempContext as CanvasRenderingContext2D,
                    viewport,
                };
                await page.render(renderContext).promise;

                // Convert canvas to blob
                tempCanvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const dimensions = {
                                width: viewport.width,
                                height: viewport.height,
                            };

                            resolve({
                                blob,
                                dimensions,
                                url: URL.createObjectURL(blob)
                            });
                        } else {
                            reject(new Error("Failed to create blob from canvas"));
                        }

                        // Clean up canvas
                        tempCanvas.width = 0;
                        tempCanvas.height = 0;
                    },
                    "image/jpeg",
                    quality
                );
            } catch (error) {
                reject(error);
            }
        };

        convertPdfToImage();
    });
}

// Main function to get PDF image (cache-first approach)
export async function getPdfImage(
    pdfData: string,
    scale?: number,
    quality: number = 0.9
): Promise<PdfImageData> {
    // Determine scale based on device
    const isIOS = /Safari/.test(navigator.userAgent);
    const finalScale = scale || (isIOS ? 1.75 : 2);
    
    const cacheKey = generateCacheKey(pdfData, finalScale);

    try {
        // First, try to load from cache
        console.log("Checking cache for PDF image...");
        const cachedData = await loadBlobFromCache(cacheKey);
        
        if (cachedData) {
            console.log("PDF image loaded from cache");
            return cachedData;
        }

        // If not in cache, render the PDF
        console.log("Rendering PDF to image...");
        const imageData = await renderPdfToBlob(pdfData, finalScale, quality);
        
        // Cache the rendered image
        await saveBlobToCache(cacheKey, imageData.blob, imageData.dimensions);
        console.log("PDF converted to image and cached successfully");
        
        return imageData;
    } catch (error) {
        console.error("Error getting PDF image:", error);
        throw error;
    }
}

// Clean up old cache entries
export async function cleanupImageCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CACHE_STORE_NAME], "readwrite");
        const store = transaction.objectStore(CACHE_STORE_NAME);
        const index = store.index("timestamp");
        
        const cutoffTime = Date.now() - maxAge;
        const range = IDBKeyRange.upperBound(cutoffTime);
        
        await new Promise<void>((resolve, reject) => {
            const request = index.openCursor(range);
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        db.close();
        console.log("Cache cleanup completed");
    } catch (error) {
        console.error("Error cleaning up cache:", error);
        throw error;
    }
}

// Get cache statistics
export async function getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
}> {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CACHE_STORE_NAME], "readonly");
        const store = transaction.objectStore(CACHE_STORE_NAME);
        
        let totalEntries = 0;
        let totalSize = 0;
        let oldestEntry: number | null = null;
        let newestEntry: number | null = null;
        
        await new Promise<void>((resolve, reject) => {
            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    const entry = cursor.value as CacheEntry;
                    totalEntries++;
                    totalSize += entry.blob.size;
                    
                    if (oldestEntry === null || entry.timestamp < oldestEntry) {
                        oldestEntry = entry.timestamp;
                    }
                    if (newestEntry === null || entry.timestamp > newestEntry) {
                        newestEntry = entry.timestamp;
                    }
                    
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        db.close();
        
        return {
            totalEntries,
            totalSize,
            oldestEntry,
            newestEntry
        };
    } catch (error) {
        console.error("Error getting cache stats:", error);
        return {
            totalEntries: 0,
            totalSize: 0,
            oldestEntry: null,
            newestEntry: null
        };
    }
}

// Clear all cache entries
export async function clearAllCache(): Promise<void> {
    try {
        const db = await openCacheDB();
        const transaction = db.transaction([CACHE_STORE_NAME], "readwrite");
        const store = transaction.objectStore(CACHE_STORE_NAME);
        
        await new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        db.close();
        console.log("All cache entries cleared");
    } catch (error) {
        console.error("Error clearing cache:", error);
        throw error;
    }
}

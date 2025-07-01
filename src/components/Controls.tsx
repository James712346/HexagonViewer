import React, { useRef } from "react";
import { useControls } from "react-zoom-pan-pinch";
import { databaseProps } from "../types.ts";
import { clearDatabaseStorage, downloadDatabase } from "../helpers/database.ts";
import { mergeDatabases } from "../helpers/mergeDatabase.ts"; // Assuming you save the merge function here
import initSqlJs from "sql.js";
import sqliteUrl from "../assets/sql-wasm.wasm?url";

export const Controls: React.FC<databaseProps> = ({database, setDatabase}) => {
    const { zoomIn, zoomOut, resetTransform } = useControls();
    const mergeFileInputRef = useRef<HTMLInputElement>(null);

    const handleMergeFile = async () => {
        if (!database) {
            alert("No current database loaded. Please load a database first.");
            return;
        }

        // Trigger file input
        mergeFileInputRef.current?.click();
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            // Show loading state (you might want to add a loading indicator)
            console.log("Loading database file for merge...");

            // Initialize SQL.js
            const SQL = await initSqlJs({ locateFile: () => sqliteUrl });

            // Read the file
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const data = new Uint8Array(arrayBuffer);
                    const newDb = new SQL.Database(data);

                    // Confirm merge operation
                    const confirmMerge = confirm(
                        "This will merge the uploaded database with your current database.\n\n" +
                        "• Hexagon tables from the new file will replace existing ones\n" +
                        "• Your existing non-hexagon tables (PDFs, markups, etc.) will be preserved\n\n" +
                        "Do you want to continue?"
                    );

                    if (!confirmMerge) {
                        newDb.close();
                        return;
                    }

                    // Perform the merge
                    console.log("Starting database merge...");
                    await mergeDatabases(database, newDb, setDatabase);
                    
                    alert("Database merge completed successfully!");
                    console.log("Database merge completed");

                } catch (error) {
                    console.error("Error during merge:", error);
                    alert(`Failed to merge database: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            };

            reader.onerror = () => {
                alert("Failed to read the database file.");
            };

            reader.readAsArrayBuffer(file);

        } catch (error) {
            console.error("Error loading file for merge:", error);
            alert(`Failed to load database file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            // Clear the input so the same file can be selected again
            if (event.target) {
                event.target.value = '';
            }
        }
    };

    return (
        <div className="controls">
            <button type="button" onClick={() => zoomIn()}>
                <i className="fa fa-plus"></i>
            </button>
            <button type="button" onClick={() => zoomOut()}>
                <i className="fa fa-minus"></i>
            </button>
            <button type="button" onClick={() => resetTransform()}>
                <i className="fa fa-undo"></i>
            </button>
            <button type="button" onClick={() => downloadDatabase(database, 'exported.sqlite')}>
                <i className="fa fa-download"></i>
            </button>
            <button 
                type="button" 
                onClick={handleMergeFile}
                title="Merge database - Upload a new database file to merge with current data"
                disabled={!database}
            >
                <i className="fa fa-code-fork"></i>
            </button>
            <button type="button" onClick={() => console.log("EDIT")}>
                <i className="fa fa-pencil"></i>
            </button>
            <button type="button" onClick={() => {confirm("Do you want to delete the local storage?") ? clearDatabaseStorage(setDatabase):null}}>
                <i className="fa fa-trash"></i>
            </button>
            
            {/* Hidden file input for merge functionality */}
            <input
                ref={mergeFileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />
        </div>
    );
};

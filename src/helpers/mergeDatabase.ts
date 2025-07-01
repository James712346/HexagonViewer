import { Database } from "sql.js";
import { saveDatabase } from "./database.ts"; // Assuming your existing database functions are in database.ts

export async function mergeDatabases(
    currentDb: Database,
    newDb: Database,
    setDatabase: (db: Database | null) => void
): Promise<Database> {
    try {
        // Define hexagon table patterns
        const hexagonTablePrefixes = ['hexagon_dump_'];
        
        // Get all table names from the new database
        const newDbTables = newDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'");
        const newTableNames = newDbTables[0]?.values.map(row => row[0] as string) || [];
        
        // Get all table names from the current database
        const currentDbTables = currentDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'");
        const currentTableNames = currentDbTables[0]?.values.map(row => row[0] as string) || [];
        
        // Identify hexagon and non-hexagon tables in new database
        const newHexagonTables = newTableNames.filter(tableName => 
            hexagonTablePrefixes.some(prefix => tableName.startsWith(prefix))
        );
        const newNonHexagonTables = newTableNames.filter(tableName => 
            !hexagonTablePrefixes.some(prefix => tableName.startsWith(prefix))
        );
        
        // Identify non-hexagon tables in current database
        const currentNonHexagonTables = currentTableNames.filter(tableName => 
            !hexagonTablePrefixes.some(prefix => tableName.startsWith(prefix))
        );
        
        console.log('New hexagon tables:', newHexagonTables);
        console.log('New non-hexagon tables to drop:', newNonHexagonTables);
        console.log('Current non-hexagon tables to copy:', currentNonHexagonTables);
        
        // Step 1: Drop non-hexagon tables from new database
        for (const tableName of newNonHexagonTables) {
            try {
                newDb.run(`DROP TABLE IF EXISTS "${tableName}"`);
                console.log(`Dropped table: ${tableName}`);
            } catch (error) {
                console.warn(`Failed to drop table ${tableName}:`, error);
            }
        }
        
        // Step 2: Copy non-hexagon tables from current database to new database
        for (const tableName of currentNonHexagonTables) {
            try {
                // Get table schema from current database
                const schemaResult = currentDb.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
                if (schemaResult.length === 0 || !schemaResult[0].values.length) {
                    console.warn(`No schema found for table: ${tableName}`);
                    continue;
                }
                
                const createTableSQL = schemaResult[0].values[0][0] as string;
                
                // Create table in new database
                newDb.run(createTableSQL);
                console.log(`Created table schema: ${tableName}`);
                
                // Get all data from current database table
                const dataResult = currentDb.exec(`SELECT * FROM "${tableName}"`);
                if (dataResult.length === 0 || !dataResult[0].values.length) {
                    console.log(`No data to copy for table: ${tableName}`);
                    continue;
                }
                
                const columns = dataResult[0].columns;
                const rows = dataResult[0].values;
                
                // Prepare insert statement
                const placeholders = columns.map(() => '?').join(', ');
                const insertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(', ')}) VALUES (${placeholders})`;
                
                // Insert data in batches for better performance
                const batchSize = 1000;
                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    
                    newDb.exec('BEGIN TRANSACTION');
                    try {
                        for (const row of batch) {
                            newDb.run(insertSQL, row);
                        }
                        newDb.exec('COMMIT');
                    } catch (error) {
                        newDb.exec('ROLLBACK');
                        throw error;
                    }
                }
                
                console.log(`Copied ${rows.length} rows to table: ${tableName}`);
                
            } catch (error) {
                console.error(`Failed to copy table ${tableName}:`, error);
                throw error;
            }
        }
        
        // Step 3: Save the merged database and update state
        await saveDatabase(newDb);
        setDatabase(newDb);
        
        console.log('Database merge completed successfully');
        console.log(`Merged database contains ${newHexagonTables.length} hexagon tables and ${currentNonHexagonTables.length} non-hexagon tables`);
        
        return newDb;
        
    } catch (error) {
        console.error('Error during database merge:', error);
        throw error;
    }
}

export function getTableInfo(db: Database): {
    hexagonTables: string[];
    nonHexagonTables: string[];
    allTables: string[];
} {
    const hexagonTablePrefixes = ['hexagon_dump_'];
    
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'");
    const allTables = tablesResult[0]?.values.map(row => row[0] as string) || [];
    
    const hexagonTables = allTables.filter(tableName => 
        hexagonTablePrefixes.some(prefix => tableName.startsWith(prefix))
    );
    
    const nonHexagonTables = allTables.filter(tableName => 
        !hexagonTablePrefixes.some(prefix => tableName.startsWith(prefix))
    );
    
    return {
        hexagonTables,
        nonHexagonTables,
        allTables
    };
}


export function previewMerge(currentDb: Database, newDb: Database): {
    currentInfo: ReturnType<typeof getTableInfo>;
    newInfo: ReturnType<typeof getTableInfo>;
    tablesToDrop: string[];
    tablesToCopy: string[];
    finalTableCount: number;
} {
    const currentInfo = getTableInfo(currentDb);
    const newInfo = getTableInfo(newDb);
    
    const tablesToDrop = newInfo.nonHexagonTables;
    const tablesToCopy = currentInfo.nonHexagonTables;
    const finalTableCount = newInfo.hexagonTables.length + currentInfo.nonHexagonTables.length;
    
    return {
        currentInfo,
        newInfo,
        tablesToDrop,
        tablesToCopy,
        finalTableCount
    };
}

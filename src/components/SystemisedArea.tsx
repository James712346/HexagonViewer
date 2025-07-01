import React, { useEffect, useState } from "react";
import {
    BoardArea,
    focusBoard,
    ItemCardProps,
    ItemCardsProps,
    Panel,
} from "../types.ts";
import { Gauge } from "@mui/x-charts/Gauge";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { renderProgress } from "./progressColumn.tsx";
export const SystemisedPanel: React.FC<Panel> = ({ back, children }) => {
    return (
        <div className="systemisedPanel">
            <div className="panel-back" onClick={back} />
            <div className="panel-content">
                {children}
            </div>
        </div>
    );
};
interface TaskData {
    asset_id: string;
    task_id: string;
    task_state: string;
    description: string;
    completion_percentage: number;
    lastStepCompleted?: string;
    system_asset_location?: string;
    second_asset_location?: string;
    responsible_company?: string;
}

export const SystemisedItemCard: React.FC<ItemCardProps> = (
    { board, database, children, tableLarger },
) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [taskData, setTaskData] = useState<TaskData[]>([]);
    const [gaugeData, setGaugeData] = useState<
        Array<{
            type: string;
            description: string;
            value: number;
        }>
    >([]);
    tableLarger = tableLarger == true;
    const columnVisibilityModel = {
        asset_id: tableLarger,
        task_id: true,
        task_state: true,                   // show
        description: true,                 // hide
        system_asset_location: tableLarger,       // hide
        second_asset_location: tableLarger,       // hide
        responsible_company: tableLarger,         // hide
        lastStepCompleted: tableLarger,          // hide
        completion_percentage: true,        // show
    };
    // DataGrid columns configuration
    const columns: GridColDef[] = [
        {
            field: "asset_id",
            headerName: "Asset ID",
            width: 120,
            flex: 1,
        },
        {
            field: "task_id",
            headerName: "Task ID",
            width: 150,
            flex: 1,
        },
        {
            field: "task_state",
            headerName: "Task State",
            width: 120,
            flex: 1,
        },
        {
            field: "description",
            headerName: "Description",
            width: 300,
            flex: 2,
        },
        {
            field: "completion_percentage",
            headerName: "Completion %",
            width: 130,
            flex: 1,
            type: "number",
            renderCell: renderProgress,
        },
        {
            field: "lastStepCompleted",
            headerName: "Last Step Completed",
            width: 180,
            flex: 1,
            type: "dateTime",
            valueGetter: (value) => value && new Date(value),
            valueFormatter: (value:DateConstructor) => value && value.toLocaleString("en-AU")
        },
        {
            field: "system_asset_location",
            headerName: "From Location",
            width: 200,
            flex: 1,
        },
        {
            field: "second_asset_location",
            headerName: "To Location",
            width: 200,
            flex: 1,
        },
        {
            field: "responsible_company",
            headerName: "Responsible Company",
            width: 180,
            flex: 1,
        },
    ];
    useEffect(() => {
        const fetchBoardData = async () => {
            try {
                setLoading(true);
                setError(null);

                const sql = `
          SELECT DISTINCT 
                    hdt.asset_id, 
                    hdt.task_id, 
                    hdt.task_state, 
                    hdt.description, 
                    (hdt.completion_percentage * 100) as completion_percentage, 
                    (SELECT MAX(hdts.completed_date) 
                     FROM hexagon_dump_task_steps_dump as hdts 
                     WHERE hdts.task_id = hdt.task_id) as lastStepCompleted, 
                    hda.location as system_asset_location,
                    hda2.location as second_asset_location, 
                    hdt.responsible_company
                FROM hexagon_dump_tasks_dump hdt
                LEFT OUTER JOIN main.hexagon_dump_assets hda 
                    ON hdt.system_asset = hda.asset_id
                LEFT OUTER JOIN main.hexagon_dump_assets hda2 
                    ON SUBSTR(hdt.asset_id,
                        INSTR(hdt.asset_id, '-') + 1,
                        INSTR(SUBSTR(hdt.asset_id, INSTR(hdt.asset_id, '-') + 1), '-') - 1
                    ) = hda2.asset_id
                WHERE hdt.asset_id LIKE ? AND hdt.asset_id NOT LIKE '%TEMP%'
                `;
                const result = database.exec(sql, [`%${board}%`]);

                console.log("Task data result:", result);

                let rows: TaskData[] = [];

                if (result && result.length > 0 && result[0].values) {
                    const columns = result[0].columns;
                    const values = result[0].values;

                    rows = values.map((row: any[]) => {
                        const obj: any = { id: `${row[0]}-${Math.random()}` }; // Add unique id for DataGrid
                        columns.forEach((col: string, index: number) => {
                            obj[col] = row[index];
                        });
                        return obj as TaskData & { id: string };
                    });
                }

                setTaskData(rows);

                // Calculate gauge values by type
                const calculateGaugeValuesByType = (tasks: TaskData[]) => {
                    const typeMap = new Map<
                        string,
                        { tasks: TaskData[]; description: string }
                    >();

                    // Group tasks by type (extracted from task_id pattern T-{type}-###)
                    tasks.forEach((task) => {
                        const match = task.task_id.match(
                            /T-([E][A-Z]\d{3})-\d+/,
                        );
                        if (match) {
                            const type = match[1];
                            if (!typeMap.has(type)) {
                                typeMap.set(type, {
                                    tasks: [],
                                    description: task.description || "",
                                });
                            }
                            typeMap.get(type)!.tasks.push(task);
                        }
                    });

                    // Calculate percentage for each type and create gauge data
                    const gauges: Array<
                        { type: string; description: string; value: number }
                    > = [];

                    typeMap.forEach((data, type) => {
                        const totalPercentage = data.tasks.reduce(
                            (sum, task) =>
                                sum + (task.completion_percentage || 0),
                            0,
                        );
                        const averagePercentage = data.tasks.length > 0
                            ? totalPercentage / data.tasks.length
                            : 0;

                        gauges.push({
                            type,
                            description: data.description,
                            value: Math.min(averagePercentage, 100),
                        });
                    });

                    // Sort by type alphabetically
                    return gauges.sort((a, b) => a.type.localeCompare(b.type));
                };

                setGaugeData(calculateGaugeValuesByType(rows));
            } catch (err) {
                console.error("Error fetching board data:", err);
                setError("Failed to fetch board data");
            } finally {
                setLoading(false);
            }
        };

        if (database && board) {
            fetchBoardData();
        } else {
            setError("Missing database or board parameter");
        }
    }, [database, board]);

    if (loading) {
        return (
            <div className="card" style={{ alignContent: "center" }}>
                <div className="loader" style={{ margin: "auto" }}></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card">
                <h1>Error</h1>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>Board: {board}</h2>
            <p>Room ID</p>
            {children}
            <div className="gauges">
                {gaugeData.map((gauge) => (
                    <div key={gauge.type}>
                        <Gauge
                            width={100}
                            height={100}
                            value={gauge.value}
                            startAngle={0}
                            endAngle={360}
                            innerRadius="80%"
                            outerRadius="100%"
                        />
                        <h2 style={{ textAlign: "center" }}>
                            {gauge.description}
                        </h2>
                    </div>
                ))}
            </div>
            <h2>Checksheets</h2>
            <div
                style={{
                    height: (tableLarger ? 600 : 300),
                    width: "100%",
                    margin: "10px 0",
                }}
            >
                <DataGrid
                    columnVisibilityModel={columnVisibilityModel}
                    rows={taskData}
                    columns={columns}
                    initialState={{
                        pagination: {
                            paginationModel: {
                                pageSize: 50,
                            },
                        },
                    }}
                    pageSizeOptions={[5, 20, 50, 100]}
                    showToolbar
                    disableRowSelectionOnClick
                />
            </div>
        </div>
    );
};

export const SystemisedItems: React.FC<ItemCardsProps> = (
    { database, area },
) => {
    const [boards, setBoards] = useState<BoardArea[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [focusBoard, setFocusBoard] = useState<string | null>(null);

    useEffect(() => {
        const fetchBoards = async () => {
            try {
                setLoading(true);
                setError(null);

                const sql = `SELECT * FROM boardsAreas WHERE clickableArea = ?`;
                const result = database.exec(sql, [area]);

                console.log("Query result:", result);

                // Assuming database.exec returns an array of objects
                // Adjust this based on your actual database library's response format
                let rows: BoardArea[] = [];

                if (result && result.length > 0) {
                    // For SQL.js, the result structure might be different
                    // This is a common pattern, but adjust based on your database library
                    if (result[0].values && result[0].columns) {
                        const columns = result[0].columns;
                        const values = result[0].values;

                        rows = values.map((row: any[]) => {
                            const obj: any = {};
                            columns.forEach((col: string, index: number) => {
                                obj[col] = row[index];
                            });
                            return obj as BoardArea;
                        });
                    } else {
                        setError("Incorrect Formatting");
                    }
                }

                setBoards(rows);
            } catch (err) {
                console.error("Error fetching boards:", err);
                setError("Failed to fetch boards");
            } finally {
                setLoading(false);
            }
        };

        if (database && area) {
            fetchBoards();
        } else {
            setError("Failed to fetch boards");
        }
    }, [database, area]); // Re-run when database or area changes

    if (loading) {
        return (
            <div className="information" style={{ alignContent: "center" }}>
                <div className="loader" style={{ margin: "auto" }}></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="information">
                <h1>Error</h1>
                <p>{error}</p>
            </div>
        );
    }

    if (focusBoard != null) {
        return (
            <div className="information">
                <h1>Title: ID: {area}</h1>
                <SystemisedItemCard
                    board={focusBoard}
                    database={database}
                    tableLarger
                >
                    <i
                        className="fa fa-xl fa-compress"
                        style={{
                            position: "relative",
                            overflow: "visible",
                            height: "0px",
                            left: "96%",
                            bottom: "31px",
                        }}
                        onClick={() => setFocusBoard(null)}
                    />
                </SystemisedItemCard>
            </div>
        );
    }
    return (
        <div className="information">
            <h1>Title: ID: {area}</h1>
            <div className="cards">
                {boards.map((row) => (
                    <SystemisedItemCard
                        database={database}
                        board={row.board}
                    >
                        <i
                            style={{
                                position: "relative",
                                overflow: "visible",
                                height: "0px",
                                left: "96%",
                                bottom: "31px",
                            }}
                            className="fa fa-xl fa-expand"
                            onClick={() => setFocusBoard(row.board)}
                        />
                    </SystemisedItemCard>
                ))}
            </div>
        </div>
    );
};

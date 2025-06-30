import React, { useEffect, useState } from "react";
import { BoardArea, ItemCardProps, ItemCardsProps, Panel } from "../types.ts";
import { Gauge } from "@mui/x-charts/Gauge";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
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
  task_id: string;
  task_state: string;
  description: string;
  completion_percentage: number;
}


export const SystemisedItemCard: React.FC<ItemCardProps> = ({ board, database }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [taskData, setTaskData] = useState<TaskData[]>([]);
  const [gaugeData, setGaugeData] = useState<Array<{
    type: string;
    description: string;
    value: number;
  }>>([]);

  // DataGrid columns configuration
  const columns: GridColDef[] = [
    { 
      field: 'asset_id', 
      headerName: 'Asset ID', 
      width: 120,
      flex: 1 
    },
    { 
      field: 'task_id', 
      headerName: 'Task ID', 
      width: 150,
      flex: 1 
    },
    { 
      field: 'task_state', 
      headerName: 'Task State', 
      width: 120,
      flex: 1 
    },
    { 
      field: 'description', 
      headerName: 'Description', 
      width: 300,
      flex: 2 
    },
    { 
      field: 'completion_percentage', 
      headerName: 'Completion %', 
      width: 130,
      flex: 1,
      type: 'number'
    },
  ];

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const sql = `
          SELECT asset_id, task_id, task_state, description, (completion_percentage * 100) as completion_percentage
          FROM hexagon_dump_tasks_dump
          WHERE asset_id LIKE ? AND asset_id NOT LIKE '%TEMP%'
        `;
        const result = database.exec(sql, [`%${board}%`]);
        
        console.log('Task data result:', result);
        
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
          const typeMap = new Map<string, { tasks: TaskData[], description: string }>();
          
          // Group tasks by type (extracted from task_id pattern T-{type}-###)
          tasks.forEach(task => {
            const match = task.task_id.match(/T-([E][A-Z]\d{3})-\d+/);
            if (match) {
              const type = match[1];
              if (!typeMap.has(type)) {
                typeMap.set(type, { tasks: [], description: task.description || '' });
              }
              typeMap.get(type)!.tasks.push(task);
            }
          });
          
          // Calculate percentage for each type and create gauge data
          const gauges: Array<{ type: string; description: string; value: number }> = [];
          
          typeMap.forEach((data, type) => {
            const totalPercentage = data.tasks.reduce((sum, task) => sum + (task.completion_percentage || 0), 0);
            const averagePercentage = data.tasks.length > 0 ? totalPercentage / data.tasks.length : 0;
            
            gauges.push({
              type,
              description: data.description,
              value: Math.min(averagePercentage, 100)
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
      <div style={{ height: 300, width: "100%", margin: "10px 0" }}>
        <DataGrid 
          rows={taskData} 
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 50,
              },
            },
          }}
          pageSizeOptions={[5, 20,50, 100]}
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

    return (
        <div className="information">
            <h1>Title: ID: {area}</h1>
            <div className="cards">
                {boards.map((row, index) => (
                    <SystemisedItemCard
                        key={`${row.board}-${index}`} // Use a unique key
                        database={database}
                        board={row.board}
                    />
                ))}
            </div>
        </div>
    );
};

import { useState } from "react";
import PdfViewer from "./PdfViewer.tsx";
import PopupWelcome from "./Welcome.tsx";
import { Database } from "sql.js";
import { Controls } from "./components/Controls.tsx";
import { checkGetDatabase } from "./helpers/database.ts";
import {
    SystemisedItems,
    SystemisedPanel,
} from "./components/SystemisedArea.tsx";

function App() {
    const [database, setDatabase] = useState < Database | null > (null);
    const [area, setArea] = useState < string | null > (null);
    // const [editing, setEditing] = useState < boolean > (false);
    const backFun = () => { setArea(null) };
    if (database == null) {
        checkGetDatabase(setDatabase);
    }
    return (
        (database == null) ? <PopupWelcome setDatabase={setDatabase} /> : (
            <div>
                <PdfViewer database={database} setArea={setArea}>
                    <Controls database={database} setDatabase={setDatabase}/>
                    {(area == null) ? <div /> : (
                        <SystemisedPanel back={backFun}>
                            <SystemisedItems area={area} database={database}/>
                        </SystemisedPanel>
                    )}
                </PdfViewer>
            </div>
        )
    );
}

export default App;

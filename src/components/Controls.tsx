import React from "react";
import { useControls } from "react-zoom-pan-pinch";
import { databaseProps } from "../types.ts";
import { clearDatabaseStorage, downloadDatabase } from "../helpers/database.ts";

export const Controls: React.FC<databaseProps> = ({database,setDatabase}) => {
    const { zoomIn, zoomOut, resetTransform } = useControls();

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
            <button type="button" onClick={() => console.log("EDIT")}>
                <i className="fa fa-pencil"></i>
            </button>
            <button type="button" onClick={() => {confirm("Do you want to delete the local storage?") ? clearDatabaseStorage(setDatabase):null}}>
                <i className="fa fa-trash"></i>
            </button>
        </div>
    );
};

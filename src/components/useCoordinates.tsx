import React from "react";
import { useControls } from "react-zoom-pan-pinch";

export const Controls: React.FC = () => {
    const { zoomIn, zoomOut, resetTransform } = useControls();

    return (
        <div className="controls">
            <button onClick={() => zoomIn()}>
                <i className="fa fa-plus"></i>
            </button>
            <button onClick={() => zoomOut()}>
                <i className="fa fa-minus"></i>
            </button>
            <button onClick={() => resetTransform()}>
                <i className="fa fa-undo"></i>
            </button>
        </div>
    );
};

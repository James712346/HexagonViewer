import React from "react";
import { Coordinates } from "../types.ts";

interface CoordinateDisplayProps {
    coordinates: Coordinates;
}

export const CoordinateDisplay: React.FC<CoordinateDisplayProps> = (
    { coordinates },
) => {
    return (
        <div
            style={{
                position: "fixed",
                bottom: 10,
                right: 10,
                backgroundColor: "white",
                padding: "10px",
                border: "1px solid black",
            }}
        >
            X: {coordinates.x.toFixed(2)}, Y: {coordinates.y.toFixed(2)}
        </div>
    );
};

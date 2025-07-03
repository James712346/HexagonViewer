import React from "react";
import { OverlayProps } from "../types.ts";
import { Tooltip } from "@mui/material";
interface OverlayComponentProps {
    overlay: OverlayProps;
    onClick: () => void;
}
export const Overlay: React.FC<OverlayComponentProps> = (
    { overlay, onClick },
) => {
    const { id, x, y, width, height, label, room } = overlay;
    return (
        <Tooltip title={`${room} - ${label}`}>
            <div
                key={id}
                id={id}
                onClick={onClick}
                className="overlay"
                style={{
                    position: "absolute",
                    top: y,
                    left: x,
                    width: width,
                    height: height,
                    fontSize: "50%",
                    color: "transparent",
                    cursor: "pointer",
                }}
            >
            </div>
        </Tooltip>
    );
};

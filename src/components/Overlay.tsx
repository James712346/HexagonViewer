import React from "react";
import { OverlayProps } from "../types.ts";
interface OverlayComponentProps {
    overlay: OverlayProps;
    onClick: () => void;
}
export const Overlay: React.FC<OverlayComponentProps> = (
    { overlay, onClick },
) => {
    const { id, x, y, width, height } = overlay;

    return (
        <div
            key={id}
            onClick={onClick}
            className="overlay"
            style={{
                position: "absolute",
                top: y,
                left: x,
                width: width,
                height: height,
                cursor: "pointer",
                border: "1px black solid"
            }}
        >
        </div>
    );
};

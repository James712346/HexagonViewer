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
    const isIOS = /Safari/.test(navigator.userAgent);
    const scaleConversion = (isIOS) ? 0.875 : 1;
    return (
        <div
            key={id}
            onClick={onClick}
            className="overlay"
            style={{
                position: "absolute",
                top: y * scaleConversion,
                left: x * scaleConversion,
                width: width * scaleConversion,
                height: height * scaleConversion,
                cursor: "pointer",
            }}
        >
        </div>
    );
};

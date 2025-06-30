import React from "react";
import { Overlay } from "./Overlay.tsx";
import { OverlayProps } from "../types.ts";

interface OverlayContainerProps {
    overlays: OverlayProps[];
    onOverlayClick: (overlayId: string) => void;
}

export const OverlayContainer: React.FC<OverlayContainerProps> = (
    { overlays, onOverlayClick },
) => {
    return (
        <>
            {overlays.map((overlay) => (
                <Overlay
                    key={overlay.id}
                    overlay={overlay}
                    onClick={() => {
                        console.log(`Overlay ${overlay.id} clicked`);
                        onOverlayClick(overlay.id);
                    }}
                />
            ))}
        </>
    );
};

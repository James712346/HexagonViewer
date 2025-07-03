import React, { useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { Database } from "sql.js";
import { CoordinateDisplay } from './components/CoordinateDisplay.tsx';
import { OverlayContainer } from './components/OverlayContainer.tsx';
import { usePdfData } from './hooks/usePdfData.ts';
import { useCoordinates } from './hooks/useCoordinates.ts';
import { PdfObject } from './components/PdfObject.tsx';

interface PdfViewerProps {
  database: Database;
  setArea: (board: string) => void;
  selectedArea: string | null;
  setSelectedArea: (area: string | null) => void;
  children?: React.ReactNode;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ 
  database, 
  setArea, 
  selectedArea, 
  setSelectedArea, 
  children 
}) => {
  const { pdfData, overlays } = usePdfData(database);
  const { coordinates, handleMouseMove, handleScaleChange } = useCoordinates();
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const isZoomingRef = useRef(false);

  const handleOverlayClick = (overlayId: string) => {
    setArea(overlayId);
  };

  // Handle zoom to selected area
  useEffect(() => {
    if (selectedArea && transformRef.current) {
      // Find the overlay data by filtering overlays with the selectedArea id
      const targetOverlay = overlays.find(overlay => overlay.id === selectedArea);
      
      if (!targetOverlay) {
        console.warn(`Overlay with id "${selectedArea}" not found`);
        return;
      }
      
      isZoomingRef.current = true;
      
      const { x, y, width, height } = targetOverlay;
      
      // Calculate the center of the selected area
      const centerX = x + width / 2;
      const centerY = y + height * 2.5;
      
      // Zoom to the area with scale 10
      transformRef.current.setTransform(
        -centerX * 10 + (1670 / 2), // positionX - center the area horizontally
        -centerY * 10 + (2055.75 / 2), // positionY - center the area vertically
        10, // scale
        500, // animation duration
      );
      
      // Reset zooming flag after animation completes
      setTimeout(() => {
        isZoomingRef.current = false;
      }, 500);
    }
  }, [selectedArea, overlays]);

  // Handle any transform changes to detect user interaction
  const handleTransformChange = (event: any) => {
    handleScaleChange(event);
    
    // If user is interacting while we're zooming to selected area, cancel the selection
    if (selectedArea && !isZoomingRef.current) {
      setSelectedArea(null);
    }
  };

  // Handle wheel events to detect zoom changes
  const handleWheel = () => {
    if (selectedArea && !isZoomingRef.current) {
      setSelectedArea(null);
    }
  };

  // Handle pan start to detect dragging
  const handlePanningStart = () => {
    if (selectedArea && !isZoomingRef.current) {
      setSelectedArea(null);
    }
  };

  return (
    <div style={{ overflow: 'hidden', width: '1670px', height: '2055.75px'}}>
      <TransformWrapper
        ref={transformRef}
        initialScale={0.81}
        onTransformed={handleTransformChange}
        onPanningStart={handlePanningStart}
        onWheel={handleWheel}
        limitToBounds={false}
        minScale={0.71}
        maxScale={50}
      >
        {() => (
          <>
            <TransformComponent>
              <PdfObject pdfData={pdfData} onMouseMove={handleMouseMove}>
                <OverlayContainer 
                  overlays={overlays} 
                  onOverlayClick={handleOverlayClick} 
                />
              </PdfObject>
            </TransformComponent>
            {children}
            <CoordinateDisplay coordinates={coordinates} />
          </>
        )}
      </TransformWrapper>
    </div>
  );
};

export default PdfViewer;

import React from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Database } from "sql.js";
import { CoordinateDisplay } from './components/CoordinateDisplay.tsx';
import { OverlayContainer } from './components/OverlayContainer.tsx';
import { usePdfData } from './hooks/usePdfData.ts';
import { useCoordinates } from './hooks/useCoordinates.ts';
import { PdfObject } from './components/PdfObject.tsx';

interface PdfViewerProps {
  database: Database;
  setArea: (board: string) => void;
  children?: React.ReactNode;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ database,setArea, children }) => {
  const { pdfData, overlays } = usePdfData(database);
  const { coordinates, handleMouseMove, handleScaleChange } = useCoordinates();
  const handleOverlayClick = (overlayId: string) => {
    setArea(overlayId);
  };

  return (
    <div style={{ overflow: 'hidden', width: '1670px', height: '2055.75px'}}>
      <TransformWrapper
        initialScale={0.81}
        onTransformed={handleScaleChange}
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

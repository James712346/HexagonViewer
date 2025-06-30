import React, { memo, useEffect, useRef } from "react";
import {
    getDocument,
    GlobalWorkerOptions,
    PDFDocumentProxy,
    version,
} from "pdfjs-dist";

GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

interface PdfCanvasProps {
    pdfData: string;
    onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
    children?: React.ReactNode;
}

export const PdfCanvas: React.FC<PdfCanvasProps> = memo(
    ({ pdfData, onMouseMove, children }) => {
        const canvasRef = useRef < HTMLCanvasElement > (null);

        useEffect(() => {
            if (!pdfData || !canvasRef.current) return;

            const loadPdf = async () => {
                try {
                    const loadingTask = getDocument({ data: atob(pdfData) });
                    const pdfDoc: PDFDocumentProxy = await loadingTask.promise;
                    const pageNumber = 1;
                    const page = await pdfDoc.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 1.75 });
                    const canvas = canvasRef.current!;
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext("2d");

                    if (context) {
                        const renderContext = {
                            canvasContext: context,
                            viewport,
                        };
                        await page.render(renderContext).promise;
                        console.log("PDF rendered successfully");
                    }
                } catch (err) {
                    console.error("Error rendering the PDF:", err);
                }
            };

            loadPdf();
        }, [pdfData]); // Only re-run when pdfData changes

        return (
            <div onMouseMove={onMouseMove}>
                <canvas
                    ref={canvasRef}
                    style={{ border: "1px solid black", width: "100vw" }}
                />
                {children}
            </div>
        );
    },
);

PdfCanvas.displayName = "PdfCanvas";

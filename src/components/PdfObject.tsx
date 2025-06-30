import React, { memo, useEffect, useState } from "react";
import { PdfImageProps } from "../types.ts";
import { getPdfImage, PdfImageData } from "../helpers/pdf.ts";

export const PdfObject: React.FC<PdfImageProps> = memo(
    ({ pdfData, onMouseMove, children }) => {
        const [imageData, setImageData] = useState<PdfImageData | null>(null);
        const [isLoading, setIsLoading] = useState<boolean>(true);
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
            if (!pdfData) return;

            const loadPdfImage = async () => {
                setIsLoading(true);
                setError(null);

                try {
                    const data = await getPdfImage(pdfData);
                    setImageData(data);
                } catch (err) {
                    console.error("Error loading PDF image:", err);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load PDF",
                    );
                } finally {
                    setIsLoading(false);
                }
            };

            loadPdfImage();

            // Cleanup function to revoke object URL
            return () => {
                if (imageData?.url) {
                    URL.revokeObjectURL(imageData.url);
                }
            };
        }, [pdfData]);

        // Cleanup object URL when component unmounts or imageData changes
        useEffect(() => {
            return () => {
                if (imageData?.url) {
                    URL.revokeObjectURL(imageData.url);
                }
            };
        }, [imageData]);

        if (isLoading) {
            return (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100vh",
                        width: "100vw",
                    }}
                >
                    <div>
                        <div className="loader"></div>
                        <p>Loading PDF...</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "200px",
                        border: "1px solid red",
                        color: "red",
                    }}
                >
                    <p>Error: {error}</p>
                </div>
            );
        }

        if (!imageData) {
            return (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "200px",
                        border: "1px solid gray",
                    }}
                >
                    <p>No PDF data</p>
                </div>
            );
        }

        console.log("PDF Loaded");
        return (
            <div onMouseMove={onMouseMove} style={{ position: "relative" }}>
                <img
                    src={imageData.url}
                    alt="PDF Page"
                    style={{
                        border: "1px solid black",
                        height: "auto",
                        display: "block",
                    }}
                    width={imageData.dimensions.width}
                    height={imageData.dimensions.height}
                />
                {children}
            </div>
        );
    },
);

PdfObject.displayName = "PdfImage";

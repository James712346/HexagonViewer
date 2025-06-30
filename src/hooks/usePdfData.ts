import { useState, useEffect } from 'react';
import { Database } from "sql.js";
import { OverlayProps } from '../types.ts';

export const usePdfData = (database: Database) => {
  const [pdfData, setPdfData] = useState<string>('');
  const [overlays, setOverlays] = useState<OverlayProps[]>([]);

  useEffect(() => {
    // Create table if it doesn't exist
    let createTableQuery = `
      CREATE TABLE IF NOT EXISTS clickableAreas (
        id TEXT PRIMARY KEY,
        x REAL,
        y REAL,
        width REAL,
        height REAL,
        label TEXT,
        room TEXT,
        scale REAL
      );
    `;
    database.exec(createTableQuery);
    createTableQuery = `
      CREATE TABLE IF NOT EXISTS boardsAreas (
        clickableArea TEXT,
        board TEXT
      );
    `;
    database.exec(createTableQuery);
    // Load PDF data
    database.each(
      `SELECT file FROM pdf;`,
      [],
      (row) => {
        setPdfData(String(row.file));
      },
      () => {
        console.log('Finished loading PDF data');
      }
    );

    // Load overlays
    const tempOverlays: OverlayProps[] = [];
    database.each(
      `SELECT * from clickableAreas;`,
      [],
      (row) => {
        tempOverlays.push({
          id: String(row.id),
          x: Number(row.x),
          y: Number(row.y),
          width: Number(row.width),
          height: Number(row.height),
          label: String(row.label),
          room: String(row.room)
        });
      },
      () => {
        console.log("Updating Overlays");
        setOverlays(tempOverlays);
      }
    );
  }, [database]);

  return { pdfData, overlays, setOverlays };
};

import { Database } from "sql.js";

export interface Coordinates {
  x: number;
  y: number;
}

export interface TransformState {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface OverlayProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  room: string;
}

export interface PdfImageProps {
  pdfData: string;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}
export interface setDatabaseProps {
  setDatabase: (db: Database|null) => void;
}
export interface databaseProps {
  database: Database;
  setDatabase: (db: Database|null) => void;
}

export interface Panel {  
  children?: React.ReactNode;
  back: () => void;
}

export interface ItemCardsProps {
    database: Database;
    area: string | null;
}
export interface ItemCardProps {
    database: Database;
    board: string;
    tableLarger?: boolean;
    children?: React.ReactNode;
}
export interface BoardArea {
  board: string;
  clickableArea: string;
}

export interface TaskStepsProps extends ItemCardProps {
  taskId: string;
}

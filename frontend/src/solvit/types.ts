export type BoardMode = "chalkboard" | "grid" | "paper";
export type ToolId = "pen" | "arrow" | "select" | "text" | "eraser" | "undo" | "redo";
export type BrushId = "pen" | "marker";
export type ShapeId = "circle" | "rect" | "triangle" | "line" | "arrow" | "diamond" | "star";
export type HighlighterId = "yellow" | "red" | "green";

export interface Message {
  role: "ai" | "user";
  text?: string;
  math?: string[];
  extra?: string;
  math2?: string[];
  time: string;
}

export interface ToolDef {
  id: ToolId;
  title: string;
  icon: React.ReactNode;
}

export interface SideIconDef {
  id: string;
  divider?: boolean;
  icon?: React.ReactNode;
}

export interface HighlighterDef {
  id: HighlighterId;
  color: string;
  border: string;
}

export interface BoardModeDef {
  id: BoardMode;
  label: string;
}

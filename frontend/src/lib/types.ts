// ── Recognition ───────────────────────────────────────────────────────────────

export interface RecognizedElement {
  label: string;
  detail?: string;
}

export interface RecognitionResult {
  description: string;
  latex: string | null;
  content_type: string;
  elements: RecognizedElement[];
}

// ── Free-draw primitives (coordinate system: 0-100 in both x and y) ───────────
export type DrawPrimitive =
  | { type: 'line';      x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; dashed?: boolean }
  | { type: 'arrow';     x1: number; y1: number; x2: number; y2: number; color?: string; label?: string; labelPos?: number; width?: number }
  | { type: 'circle';    cx: number; cy: number; r: number; color?: string; fill?: string; width?: number }
  | { type: 'rect';      x: number;  y: number;  w: number;  h: number;  color?: string; fill?: string; width?: number }
  | { type: 'text';      x: number;  y: number;  content: string; size?: number; color?: string; align?: 'left' | 'center' | 'right'; bold?: boolean }
  | { type: 'arc';       cx: number; cy: number; r: number; startAngle: number; endAngle: number; color?: string; width?: number }
  | { type: 'path';      points: { x: number; y: number }[]; color?: string; width?: number; closed?: boolean; fill?: string; dashed?: boolean }
  | { type: 'handwrite'; x: number;  y: number;  content: string; size?: number; color?: string };

export interface FreeDiagram {
  type: 'free';
  title?: string;
  primitives: DrawPrimitive[];
}

export type DiagramType = FreeDiagram;

// ── Stroke context ────────────────────────────────────────────────────────────

export interface StyleFeatures {
  avgWidth: number;
  dominantColor: string;
  avgCurvature: number;
}

export interface StrokeBounds {
  normMinX: number;
  normMinY: number;
  normMaxX: number;
  normMaxY: number;
}

export interface StrokeContext {
  styleFeatures: StyleFeatures;
  strokeBounds: StrokeBounds | null;
  strokeCount: number;
}

export interface StrokeDelta {
  newStrokeCount: number;
  removedStrokeCount: number;
  changedRegion: StrokeBounds | null;
}

export interface ApiStroke {
  points: { x: number; y: number; pressure: number }[];
  color: string;
  width: number;
  tool: string;
}

// ── App types ─────────────────────────────────────────────────────────────────

export interface Step {
  stepNumber: number;
  explanation: string;
  diagram: DiagramType | null;
  equation: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  confidence?: number;
  ambiguities?: string[];
}

// ── Stroke context ────────────────────────────────────────────────────────────

export interface StrokeBounds {
  normMinX: number;
  normMinY: number;
  normMaxX: number;
  normMaxY: number;
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
  equation: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

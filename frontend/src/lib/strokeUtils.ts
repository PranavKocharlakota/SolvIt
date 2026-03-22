/** Client-side stroke utilities: simplification and API formatting. */

import { ApiStroke } from './types';

interface Point { x: number; y: number; pressure?: number }

interface StrokeData {
  id: string;
  points: number[];   // flat [x0,y0,x1,y1,…]
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

// ── Geometry ──────────────────────────────────────────────────────────────────

function distPointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function rdpSimplify(points: Point[], epsilon = 2): Point[] {
  if (points.length < 3) return points;
  let dmax = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distPointToSegment(points[i], points[0], points[points.length - 1]);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax >= epsilon) {
    return [
      ...rdpSimplify(points.slice(0, idx + 1), epsilon).slice(0, -1),
      ...rdpSimplify(points.slice(idx), epsilon),
    ];
  }
  return [points[0], points[points.length - 1]];
}

/** Flatten Konva points array [x0,y0,x1,y1,…] to Point objects. */
export function flatToPoints(flat: number[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < flat.length - 1; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}

/** Convert Point objects back to Konva flat array. */
export function pointsToFlat(pts: Point[]): number[] {
  return pts.flatMap(p => [p.x, p.y]);
}

// ── API format conversion ─────────────────────────────────────────────────────

/** Convert internal StrokeData[] to the format the backend Stroke model expects. */
export function strokesForAPI(strokes: StrokeData[]): ApiStroke[] {
  return strokes
    .filter(s => s.tool === 'pen')
    .map(s => ({
      points: flatToPoints(s.points).map(p => ({ x: p.x, y: p.y, pressure: 0.5 })),
      color: s.color,
      width: s.width,
      tool: s.tool,
    }));
}

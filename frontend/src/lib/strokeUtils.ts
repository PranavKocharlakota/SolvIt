/** Client-side stroke utilities: simplification, style extraction, API formatting. */

import { StyleFeatures, StrokeBounds, ApiStroke } from './types';

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

// ── Style feature extraction ──────────────────────────────────────────────────

export function extractStyleFeatures(strokes: StrokeData[]): StyleFeatures {
  const pen = strokes.filter(s => s.tool === 'pen');
  if (pen.length === 0) return { avgWidth: 3, dominantColor: '#000000', avgCurvature: 1 };

  const avgWidth = pen.reduce((s, st) => s + st.width, 0) / pen.length;

  const colorCount: Record<string, number> = {};
  for (const s of pen) colorCount[s.color] = (colorCount[s.color] || 0) + 1;
  const dominantColor = Object.entries(colorCount).sort((a, b) => b[1] - a[1])[0][0];

  let totalCurv = 0, validN = 0;
  for (const s of pen) {
    const pts = flatToPoints(s.points);
    if (pts.length < 2) continue;
    let arc = 0;
    for (let i = 1; i < pts.length; i++)
      arc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const chord = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    if (chord > 0) { totalCurv += arc / chord; validN++; }
  }

  return { avgWidth, dominantColor, avgCurvature: validN > 0 ? totalCurv / validN : 1 };
}

export function getStrokeBounds(
  strokes: StrokeData[],
  canvasWidth: number,
  canvasHeight: number,
): StrokeBounds | null {
  const pen = strokes.filter(s => s.tool === 'pen');
  if (pen.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of pen) {
    for (const p of flatToPoints(s.points)) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  return {
    normMinX: (minX / canvasWidth) * 100,
    normMinY: (minY / canvasHeight) * 100,
    normMaxX: (maxX / canvasWidth) * 100,
    normMaxY: (maxY / canvasHeight) * 100,
  };
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

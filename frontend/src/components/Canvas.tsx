import React, { useRef, useEffect, useCallback, useImperativeHandle, useState } from 'react';
import { DiagramType, FreeDiagram, DrawPrimitive } from '../lib/types';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  isEraser: boolean;
}

interface DiagramLayer {
  diagram: FreeDiagram;
  completedCount: number; // how many primitives have been drawn (for animation)
}

export interface CanvasHandle {
  getImageBase64: () => string;
  drawDiagram: (diagram: DiagramType) => void;
}

interface CanvasProps {
  onRecognize: () => void;
}

const TOOLBAR_HEIGHT = 48;
const SIDEBAR_WIDTH = 320;

// ── Naturalized drawing helpers ────────────────────────────────────────────────

/** Small random jitter for hand-drawn feel */
function jitter(ps: (v: number) => number): number {
  return (Math.random() - 0.5) * ps(0.6);
}

/** Draw a line with a slight hand-drawn wobble using a quadratic bezier */
function drawNaturalLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  ps: (v: number) => number,
) {
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * ps(1.2);
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * ps(1.2);
  ctx.beginPath();
  ctx.moveTo(x1 + jitter(ps), y1 + jitter(ps));
  ctx.quadraticCurveTo(mx, my, x2 + jitter(ps), y2 + jitter(ps));
  ctx.stroke();
}

// ── Primitive drawing ──────────────────────────────────────────────────────────

function drawPrimitive(
  p: DrawPrimitive,
  ctx: CanvasRenderingContext2D,
  px: (v: number) => number,
  py: (v: number) => number,
  ps: (v: number) => number,
  naturalize = false,
) {
  ctx.save();
  try {
    switch (p.type) {
      case 'line': {
        ctx.strokeStyle = p.color ?? '#475569';
        ctx.lineWidth = ps(p.width ?? 1.5);
        ctx.lineCap = 'round';
        if (p.dashed) ctx.setLineDash([ps(3), ps(2)]);
        const x1 = px(p.x1), y1 = py(p.y1), x2 = px(p.x2), y2 = py(p.y2);
        if (naturalize) {
          drawNaturalLine(ctx, x1, y1, x2, y2, ps);
        } else {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        break;
      }

      case 'arrow': {
        const x1 = px(p.x1), y1 = py(p.y1), x2 = px(p.x2), y2 = py(p.y2);
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 2) break;
        const ux = dx / len, uy = dy / len;
        const ah = Math.min(ps(4), len * 0.35);
        const aw = ah * 0.55;
        const color = p.color ?? '#1d4ed8';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = ps(p.width ?? 2);
        ctx.lineCap = 'round';
        // Shaft
        if (naturalize) {
          drawNaturalLine(ctx, x1, y1, x2 - ux * ah * 0.5, y2 - uy * ah * 0.5, ps);
        } else {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2 - ux * ah * 0.5, y2 - uy * ah * 0.5);
          ctx.stroke();
        }
        // Head
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ux * ah - uy * aw, y2 - uy * ah + ux * aw);
        ctx.lineTo(x2 - ux * ah + uy * aw, y2 - uy * ah - ux * aw);
        ctx.closePath();
        ctx.fill();
        // Label
        if (p.label) {
          const t = p.labelPos ?? 0.5;
          const lx = x1 + dx * t - uy * ps(4);
          const ly = y1 + dy * t + ux * ps(4);
          ctx.fillStyle = color;
          ctx.font = `bold ${ps(3.5)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.label, lx, ly);
        }
        break;
      }

      case 'circle': {
        const color = p.color ?? '#1d4ed8';
        ctx.beginPath();
        ctx.arc(px(p.cx), py(p.cy), ps(p.r), 0, Math.PI * 2);
        if (p.fill && p.fill !== 'none') { ctx.fillStyle = p.fill; ctx.fill(); }
        ctx.strokeStyle = color;
        ctx.lineWidth = ps(p.width ?? 1.5);
        ctx.stroke();
        break;
      }

      case 'rect': {
        const color = p.color ?? '#1d4ed8';
        const rx = px(p.x), ry = py(p.y);
        const rw = px(p.x + p.w) - rx;
        const rh = py(p.y + p.h) - ry;
        if (p.fill && p.fill !== 'none') { ctx.fillStyle = p.fill; ctx.fillRect(rx, ry, rw, rh); }
        ctx.strokeStyle = color;
        ctx.lineWidth = ps(p.width ?? 1.5);
        if (naturalize) {
          // Draw four sides with slight wobble
          drawNaturalLine(ctx, rx, ry, rx + rw, ry, ps);
          drawNaturalLine(ctx, rx + rw, ry, rx + rw, ry + rh, ps);
          drawNaturalLine(ctx, rx + rw, ry + rh, rx, ry + rh, ps);
          drawNaturalLine(ctx, rx, ry + rh, rx, ry, ps);
        } else {
          ctx.strokeRect(rx, ry, rw, rh);
        }
        break;
      }

      case 'text': {
        const size = ps(p.size ?? 4);
        ctx.font = `${p.bold ? 'bold ' : ''}${size}px sans-serif`;
        ctx.fillStyle = p.color ?? '#111827';
        ctx.textAlign = (p.align as CanvasTextAlign) ?? 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.content ?? ''), px(p.x), py(p.y));
        break;
      }

      case 'arc': {
        const startRad = (p.startAngle * Math.PI) / 180;
        const endRad = (p.endAngle * Math.PI) / 180;
        ctx.beginPath();
        ctx.arc(px(p.cx), py(p.cy), ps(p.r), startRad, endRad, false);
        ctx.strokeStyle = p.color ?? '#d97706';
        ctx.lineWidth = ps(p.width ?? 1.5);
        ctx.stroke();
        break;
      }

      case 'path': {
        const pts = (p.points ?? []).filter(pt => isFinite(pt.x) && isFinite(pt.y));
        if (pts.length < 2) break;
        ctx.beginPath();
        if (p.dashed) ctx.setLineDash([ps(3), ps(2)]);
        ctx.moveTo(px(pts[0].x) + (naturalize ? jitter(ps) : 0), py(pts[0].y) + (naturalize ? jitter(ps) : 0));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(px(pts[i].x) + (naturalize ? jitter(ps) : 0), py(pts[i].y) + (naturalize ? jitter(ps) : 0));
        }
        if (p.closed) ctx.closePath();
        if (p.fill && p.fill !== 'none') { ctx.fillStyle = p.fill; ctx.fill(); }
        ctx.strokeStyle = p.color ?? '#475569';
        ctx.lineWidth = ps(p.width ?? 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        break;
      }
    }
  } catch { /* skip bad primitive */ }
  ctx.restore();
}

function drawDiagramLayer(
  layer: DiagramLayer,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const px = (v: number) => v * w / 100;
  const py = (v: number) => v * h / 100;
  const ps = (v: number) => v * Math.min(w, h) / 100;
  const primitives = layer.diagram.primitives ?? [];
  const count = Math.min(layer.completedCount, primitives.length);
  for (let i = 0; i < count; i++) {
    drawPrimitive(primitives[i], ctx, px, py, ps, false);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
const Canvas = React.forwardRef<CanvasHandle, CanvasProps>(({ onRecognize }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const diagramLayerRef = useRef<DiagramLayer[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  const getCanvasSize = () => ({
    width: window.innerWidth - SIDEBAR_WIDTH,
    height: window.innerHeight - TOOLBAR_HEIGHT,
  });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.isEraser ? '#ffffff' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.stroke();
    }

    for (const layer of diagramLayerRef.current) {
      drawDiagramLayer(layer, ctx, width, height);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = getCanvasSize();
    canvas.width = width;
    canvas.height = height;
    redraw();
  }, [redraw]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = getCanvasSize();
      canvas.width = width;
      canvas.height = height;
      redraw();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = useCallback((x: number, y: number) => {
    isDrawingRef.current = true;
    const stroke: Stroke = { points: [{ x, y }], color, width: strokeWidth, isEraser: tool === 'eraser' };
    currentStrokeRef.current = stroke;
    strokesRef.current.push(stroke);
  }, [color, strokeWidth, tool]);

  const continueDraw = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    currentStrokeRef.current.points.push({ x, y });
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const pts = currentStrokeRef.current.points;
    ctx.beginPath();
    ctx.strokeStyle = currentStrokeRef.current.isEraser ? '#ffffff' : currentStrokeRef.current.color;
    ctx.lineWidth = currentStrokeRef.current.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (pts.length >= 2) {
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  }, []);

  const endDraw = useCallback(() => {
    isDrawingRef.current = false;
    currentStrokeRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseDown = (e: MouseEvent) => { const p = getPos(e, canvas); startDraw(p.x, p.y); };
    const onMouseMove = (e: MouseEvent) => { const p = getPos(e, canvas); continueDraw(p.x, p.y); };
    const onMouseUp = () => endDraw();
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0], canvas); startDraw(p.x, p.y); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); const p = getPos(e.touches[0], canvas); continueDraw(p.x, p.y); };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); endDraw(); };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [startDraw, continueDraw, endDraw]);

  useImperativeHandle(ref, () => ({
    getImageBase64: () => canvasRef.current?.toDataURL('image/png') ?? '',

    drawDiagram: (diagram: DiagramType) => {
      if (diagram.type !== 'free') {
        console.error('[drawDiagram] expected type "free", got:', (diagram as any).type);
        return;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        console.error('[drawDiagram] canvas not ready');
        return;
      }

      const free = diagram as FreeDiagram;
      const primitives = free.primitives ?? [];
      console.log('[drawDiagram] animating', primitives.length, 'primitives');

      // Add layer with completedCount=0, then animate each primitive
      const layer: DiagramLayer = { diagram: free, completedCount: 0 };
      diagramLayerRef.current.push(layer);

      const px = (v: number) => v * canvas.width / 100;
      const py = (v: number) => v * canvas.height / 100;
      const ps = (v: number) => v * Math.min(canvas.width, canvas.height) / 100;

      let i = 0;

      function drawNext() {
        if (i >= primitives.length) return;

        // Increment completed count and redraw everything clean
        layer.completedCount = i + 1;
        redraw();

        // Then draw the CURRENT primitive on top with naturalization
        drawPrimitive(primitives[i], ctx!, px, py, ps, true);

        i++;

        if (i < primitives.length) {
          // Delay between primitives: longer for complex types, shorter for text
          const p = primitives[i];
          const delay = (p.type === 'text') ? 20 : 60;
          setTimeout(drawNext, delay);
        } else {
          // Animation complete: do a final clean redraw so resize works correctly
          redraw();
        }
      }

      drawNext();
    },
  }), [redraw]);

  const handleClear = () => {
    strokesRef.current = [];
    diagramLayerRef.current = [];
    redraw();
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? '#4a9eff' : '#2a2a4a', color: '#fff', border: 'none',
    borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0,
        width: `calc(100vw - ${SIDEBAR_WIDTH}px)`, height: TOOLBAR_HEIGHT,
        background: '#16213e', borderBottom: '1px solid #2a2a4a',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', zIndex: 10,
      }}>
        <button style={btnStyle(tool === 'pen')} onClick={() => setTool('pen')}>✏️ Pen</button>
        <button style={btnStyle(tool === 'eraser')} onClick={() => setTool('eraser')}>🧹 Eraser</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa' }}>
          Color
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 32, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa' }}>
          Size
          <input type="range" min={1} max={20} value={strokeWidth}
            onChange={e => setStrokeWidth(Number(e.target.value))} style={{ width: 80 }} />
          <span style={{ color: '#fff', minWidth: 16 }}>{strokeWidth}</span>
        </label>
        <button style={btnStyle()} onClick={handleClear}>🗑️ Clear</button>
        <div style={{ flex: 1 }} />
        <button style={{ ...btnStyle(), background: '#22c55e', fontWeight: 600, padding: '6px 20px' }}
          onClick={onRecognize}>
          🔍 Recognize
        </button>
      </div>
      <canvas ref={canvasRef} style={{
        position: 'fixed', top: TOOLBAR_HEIGHT, left: 0,
        cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        display: 'block', touchAction: 'none',
      }} />
    </div>
  );
});

Canvas.displayName = 'Canvas';
export default Canvas;

import React, {
  useRef, useEffect, useCallback, useImperativeHandle, useState, forwardRef,
} from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Text } from 'react-konva';
import { FreeDiagram, DrawPrimitive, DiagramType, StrokeContext, ApiStroke, StrokeDelta } from '../lib/types';
import { rdpSimplify, flatToPoints, pointsToFlat, extractStyleFeatures, getStrokeBounds, strokesForAPI } from '../lib/strokeUtils';
import { textToPaths } from '../lib/strokeFont';
import { useHistory } from '../hooks/useHistory';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StrokeData {
  id: string;
  points: number[];      // flat [x0,y0,x1,y1,...]
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

export interface KonvaWhiteboardHandle {
  getImageBase64: () => string;
  drawDiagram: (diagram: DiagramType) => void;
  exportStrokes: () => StrokeData[];
  getStrokeContext: () => StrokeContext;
  exportStrokesForAPI: () => ApiStroke[];
  markRecognized: () => void;
  getStrokeDelta: () => StrokeDelta;
}

interface Props {
  onRecognize: () => void;
  onLiveUpdate?: (imageBase64: string) => void;
}

const TOOLBAR_H = 48;
const SIDEBAR_W = 320;

// ── Diagram layer — renders FreeDiagram primitives as Konva shapes ─────────

function DiagramLayer({ diagrams }: { diagrams: FreeDiagram[] }) {
  // We use a Konva Layer and draw primitives as Lines/Text etc.
  // For simplicity, convert each primitive to a Konva <Line> or <Text>.
  const elements: React.ReactElement[] = [];

  diagrams.forEach((diagram, di) => {
    const w = window.innerWidth - SIDEBAR_W;
    const h = window.innerHeight - TOOLBAR_H;
    const px = (v: number) => v * w / 100;
    const py = (v: number) => v * h / 100;
    const ps = (v: number) => v * Math.min(w, h) / 100;

    (diagram.primitives ?? []).forEach((p: DrawPrimitive, pi) => {
      const key = `${di}-${pi}`;
      try {
        if (p.type === 'line') {
          elements.push(
            <Line key={key}
              points={[px(p.x1), py(p.y1), px(p.x2), py(p.y2)]}
              stroke={p.color ?? '#475569'}
              strokeWidth={ps(p.width ?? 1.5)}
              lineCap="round" lineJoin="round"
              dash={p.dashed ? [ps(3), ps(2)] : undefined}
            />
          );
        } else if (p.type === 'arrow') {
          const x1 = px(p.x1), y1 = py(p.y1), x2 = px(p.x2), y2 = py(p.y2);
          elements.push(
            <Line key={key}
              points={[x1, y1, x2, y2]}
              stroke={p.color ?? '#1d4ed8'}
              strokeWidth={ps(p.width ?? 2)}
              lineCap="round"
            />
          );
        } else if (p.type === 'path') {
          const pts = (p.points ?? []).flatMap((pt: { x: number; y: number }) => [px(pt.x), py(pt.y)]);
          if (pts.length >= 4) {
            elements.push(
              <Line key={key}
                points={pts}
                stroke={p.color ?? '#475569'}
                strokeWidth={ps(p.width ?? 2)}
                fill={p.fill && p.fill !== 'none' ? p.fill : undefined}
                closed={p.closed}
                lineCap="round" lineJoin="round"
                dash={p.dashed ? [ps(3), ps(2)] : undefined}
              />
            );
          }
        } else if (p.type === 'text') {
          elements.push(
            <Text key={key}
              x={px(p.x)} y={py(p.y)}
              text={String(p.content ?? '')}
              fontSize={ps(p.size ?? 4)}
              fill={p.color ?? '#111827'}
              align={p.align ?? 'left'}
              fontStyle={p.bold ? 'bold' : 'normal'}
            />
          );
        }
      } catch { /* skip bad primitive */ }
    });
  });

  return <Layer>{elements}</Layer>;
}

// ── Main component ─────────────────────────────────────────────────────────

const KonvaWhiteboard = forwardRef<KonvaWhiteboardHandle, Props>(({ onRecognize, onLiveUpdate }, ref) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({
    width: window.innerWidth - SIDEBAR_W,
    height: window.innerHeight - TOOLBAR_H,
  });

  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [diagrams, setDiagrams] = useState<FreeDiagram[]>([]);
  const currentStroke = useRef<StrokeData | null>(null);
  const isPointerDown = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognizedStrokeIds = useRef<Set<string>>(new Set());

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  const history = useHistory<StrokeData[]>([]);

  // Track size
  useEffect(() => {
    const update = () => setSize({
      width: window.innerWidth - SIDEBAR_W,
      height: window.innerHeight - TOOLBAR_H,
    });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Undo / Redo keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          const next = history.redo();
          if (next) setStrokes(next);
        } else {
          const prev = history.undo();
          if (prev !== null) setStrokes(prev);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history]);

  const scheduleLiveUpdate = useCallback(() => {
    if (!onLiveUpdate) return;
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => {
      const img = stageRef.current?.toDataURL({ mimeType: 'image/png' });
      if (img) onLiveUpdate(img);
    }, 400);
  }, [onLiveUpdate]);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    isPointerDown.current = true;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition()!;
    const stroke: StrokeData = {
      id: crypto.randomUUID(),
      points: [pos.x, pos.y],
      color,
      width: strokeWidth,
      tool,
    };
    currentStroke.current = stroke;
    setStrokes(prev => [...prev, stroke]);
  }, [color, strokeWidth, tool]);

  const handlePointerMove = useCallback((_: Konva.KonvaEventObject<PointerEvent>) => {
    if (!isPointerDown.current || !currentStroke.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition()!;
    currentStroke.current.points = [...currentStroke.current.points, pos.x, pos.y];
    setStrokes(prev => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...currentStroke.current! };
      return copy;
    });
    scheduleLiveUpdate();
  }, [scheduleLiveUpdate]);

  const handlePointerUp = useCallback(() => {
    if (!isPointerDown.current || !currentStroke.current) return;
    isPointerDown.current = false;

    // Simplify the completed stroke
    const raw = flatToPoints(currentStroke.current.points);
    const simplified = rdpSimplify(raw, 1.5);
    currentStroke.current.points = pointsToFlat(simplified);

    const finalStrokes = strokes.map((s, i) =>
      i === strokes.length - 1 ? { ...currentStroke.current! } : s
    );
    history.push(finalStrokes);
    setStrokes(finalStrokes);
    currentStroke.current = null;
    scheduleLiveUpdate();
  }, [strokes, history, scheduleLiveUpdate]);

  useImperativeHandle(ref, () => ({
    getImageBase64: () => {
      if (!stageRef.current) return '';
      return stageRef.current.toDataURL({ mimeType: 'image/png' });
    },

    getStrokeContext: (): StrokeContext => {
      const styleFeatures = extractStyleFeatures(strokes);
      const strokeBounds = getStrokeBounds(strokes, size.width, size.height);
      return {
        styleFeatures,
        strokeBounds,
        strokeCount: strokes.filter(s => s.tool === 'pen').length,
      };
    },

    markRecognized: () => {
      recognizedStrokeIds.current = new Set(strokes.map(s => s.id));
    },

    getStrokeDelta: (): StrokeDelta => {
      const newStrokes = strokes.filter(s => s.tool === 'pen' && !recognizedStrokeIds.current.has(s.id));
      const removedCount = [...recognizedStrokeIds.current].filter(
        id => !strokes.find(s => s.id === id)
      ).length;

      let changedRegion = null;
      if (newStrokes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of newStrokes) {
          for (const p of flatToPoints(s.points)) {
            if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
          }
        }
        changedRegion = {
          normMinX: (minX / size.width) * 100,
          normMinY: (minY / size.height) * 100,
          normMaxX: (maxX / size.width) * 100,
          normMaxY: (maxY / size.height) * 100,
        };
      }

      return { newStrokeCount: newStrokes.length, removedStrokeCount: removedCount, changedRegion };
    },

    drawDiagram: (diagram: DiagramType) => {
      if (diagram.type !== 'free') return;
      const free = diagram as FreeDiagram;
      const prims = free.primitives ?? [];

      // Expand handwrite primitives → stroke font paths before animation
      const expanded: DrawPrimitive[] = prims.flatMap(p => {
        if (p.type === 'handwrite') {
          return textToPaths(p.content, p.x, p.y, p.size ?? 5, p.color ?? '#1a1a2e');
        }
        return [p];
      });

      // Apply subtle jitter to path/line/arrow endpoints for hand-drawn feel
      function jitter(v: number, amt = 0.35) { return v + (Math.random() - 0.5) * amt; }
      const jittered: DrawPrimitive[] = expanded.map(p => {
        if (p.type === 'path' && p.points) {
          return { ...p, points: p.points.map(pt => ({ x: jitter(pt.x), y: jitter(pt.y) })) };
        }
        if (p.type === 'line') return { ...p, x1: jitter(p.x1), y1: jitter(p.y1), x2: jitter(p.x2), y2: jitter(p.y2) };
        if (p.type === 'arrow') return { ...p, x1: jitter(p.x1), y1: jitter(p.y1), x2: jitter(p.x2), y2: jitter(p.y2) };
        return p;
      });

      // Build animation frames: paths grow point-by-point; other primitives appear whole
      type Frame = DrawPrimitive[];
      const frames: Frame[] = [];
      let current: DrawPrimitive[] = [];
      for (const prim of jittered) {
        if (prim.type === 'path' && prim.points && prim.points.length > 2) {
          for (let j = 2; j <= prim.points.length; j++) {
            frames.push([...current, { ...prim, points: prim.points.slice(0, j) }]);
          }
          current = [...current, prim];
        } else {
          current = [...current, prim];
          frames.push([...current]);
        }
      }

      const snapshot: FreeDiagram = { type: 'free', primitives: [] };
      setDiagrams(prev => [...prev, snapshot]);

      let fi = 0;
      function nextFrame() {
        if (fi >= frames.length) return;
        const framePrims = frames[fi];
        setDiagrams(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { type: 'free', primitives: framePrims };
          return copy;
        });
        fi++;
        if (fi >= frames.length) return;
        // Fast for path growth, slower for new primitives appearing
        const growing = frames[fi].length === framePrims.length;
        setTimeout(nextFrame, growing ? 9 : (framePrims[framePrims.length - 1]?.type === 'text' ? 20 : 55));
      }
      nextFrame();
    },

    exportStrokes: () => strokes,

    exportStrokesForAPI: () => strokesForAPI(strokes),
  }), [strokes, size]);

  const handleClear = () => {
    history.push([]);
    setStrokes([]);
    setDiagrams([]);
  };

  const btn = (active?: boolean): React.CSSProperties => ({
    background: active ? '#4a9eff' : '#2a2a4a', color: '#fff', border: 'none',
    borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, zIndex: 10,
        width: `calc(100vw - ${SIDEBAR_W}px)`, height: TOOLBAR_H,
        background: '#16213e', borderBottom: '1px solid #2a2a4a',
        display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
      }}>
        <button style={btn(tool === 'pen')} onClick={() => setTool('pen')}>✏️ Pen</button>
        <button style={btn(tool === 'eraser')} onClick={() => setTool('eraser')}>🧹 Eraser</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#aaa' }}>
          Color
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 30, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#aaa' }}>
          Size
          <input type="range" min={1} max={20} value={strokeWidth}
            onChange={e => setStrokeWidth(Number(e.target.value))} style={{ width: 70 }} />
          <span style={{ color: '#fff', minWidth: 14 }}>{strokeWidth}</span>
        </label>
        <button style={btn()} onClick={handleClear}>🗑️ Clear</button>
        <button style={btn()} onClick={() => { const n = history.undo(); if (n !== null) setStrokes(n); }}
          disabled={!history.canUndo()}>↩ Undo</button>
        <button style={btn()} onClick={() => { const n = history.redo(); if (n !== null) setStrokes(n); }}
          disabled={!history.canRedo()}>↪ Redo</button>
        <div style={{ flex: 1 }} />
        <button style={{ ...btn(), background: '#22c55e', fontWeight: 600, padding: '6px 18px' }}
          onClick={onRecognize}>
          🔍 Recognize
        </button>
      </div>

      {/* Konva stage */}
      <div style={{ position: 'fixed', top: TOOLBAR_H, left: 0 }}>
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          style={{ background: '#ffffff', cursor: tool === 'eraser' ? 'cell' : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cline x1='10' y1='0' x2='10' y2='20' stroke='black' stroke-width='1.5'/%3E%3Cline x1='0' y1='10' x2='20' y2='10' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E\") 10 10, crosshair", touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* User strokes layer */}
          <Layer>
            {strokes.map(stroke => (
              <Line
                key={stroke.id}
                points={stroke.points}
                stroke={stroke.tool === 'eraser' ? '#ffffff' : stroke.color}
                strokeWidth={stroke.tool === 'eraser' ? stroke.width * 4 : stroke.width}
                lineCap="round"
                lineJoin="round"
                tension={0.4}
              />
            ))}
          </Layer>

          {/* AI diagram layer */}
          <DiagramLayer diagrams={diagrams} />
        </Stage>
      </div>
    </div>
  );
});

KonvaWhiteboard.displayName = 'KonvaWhiteboard';
export default KonvaWhiteboard;

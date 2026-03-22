import React, {
  useRef, useEffect, useCallback, useImperativeHandle, useState, forwardRef,
} from 'react';
import Konva from 'konva';
import { Stage, Layer, Line } from 'react-konva';
import { ApiStroke, StrokeDelta } from '../lib/types';
import { rdpSimplify, flatToPoints, pointsToFlat, strokesForAPI } from '../lib/strokeUtils';
import { useHistory } from '../hooks/useHistory';

interface StrokeData {
  id: string;
  points: number[];      // flat [x0,y0,x1,y1,...]
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

export interface KonvaWhiteboardHandle {
  getImageBase64: () => string;
  exportStrokes: () => StrokeData[];
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

const KonvaWhiteboard = forwardRef<KonvaWhiteboardHandle, Props>(({ onRecognize, onLiveUpdate }, ref) => {
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({
    width: window.innerWidth - SIDEBAR_W,
    height: window.innerHeight - TOOLBAR_H,
  });

  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const currentStroke = useRef<StrokeData | null>(null);
  const isPointerDown = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognizedStrokeIds = useRef<Set<string>>(new Set());

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

  const history = useHistory<StrokeData[]>([]);

  useEffect(() => {
    const update = () => setSize({
      width: window.innerWidth - SIDEBAR_W,
      height: window.innerHeight - TOOLBAR_H,
    });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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
    getImageBase64: () => stageRef.current?.toDataURL({ mimeType: 'image/png' }) ?? '',

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

    exportStrokes: () => strokes,
    exportStrokesForAPI: () => strokesForAPI(strokes),
  }), [strokes, size]);

  const handleClear = () => {
    history.push([]);
    setStrokes([]);
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

      {/* Canvas */}
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
        </Stage>
      </div>
    </div>
  );
});

KonvaWhiteboard.displayName = 'KonvaWhiteboard';
export default KonvaWhiteboard;

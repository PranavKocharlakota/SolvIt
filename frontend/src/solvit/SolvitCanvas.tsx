import React, { useRef, useEffect, useCallback, useImperativeHandle, useState, forwardRef } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Arrow, Ellipse, Rect, Star, Text } from 'react-konva';
import { ApiStroke, StrokeDelta } from '../lib/types';
import { rdpSimplify, flatToPoints, pointsToFlat, strokesForAPI } from '../lib/strokeUtils';
import { useHistory } from '../hooks/useHistory';
import type { ShapeId } from './types';
import { latexToUnicode } from '../lib/latexToUnicode';

/* ── Element types ────────────────────────────────────────── */

interface StrokeElement {
  kind: 'stroke';
  id: string;
  points: number[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  opacity: number;
}

interface ShapeElement {
  kind: 'shape';
  id: string;
  shapeType: ShapeId;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  width: number;
  opacity: number;
}

interface TextElement {
  kind: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
}

type DrawElement = StrokeElement | ShapeElement | TextElement;

interface EditingText {
  x: number;
  y: number;
  value: string;
}

/* ── Public handle ────────────────────────────────────────── */

export interface SolvitCanvasHandle {
  getImageBase64: () => string;
  exportStrokesForAPI: () => ApiStroke[];
  markRecognized: () => void;
  getStrokeDelta: () => StrokeDelta;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  writeFormula: (latex: string) => void;
}

interface Props {
  tool: 'pen' | 'eraser' | 'text';
  color: string;
  strokeWidth: number;
  opacity?: number;
  shape?: ShapeId | null;
  onLiveUpdate?: (imageBase64: string) => void;
}

/* ── Shape renderer ───────────────────────────────────────── */

function renderShape(el: ShapeElement) {
  const { id, shapeType, x1, y1, x2, y2, color, width, opacity } = el;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;
  const common = { stroke: color, strokeWidth: width, opacity: opacity / 100, fill: 'transparent' as const };

  switch (shapeType) {
    case 'circle':
      return <Ellipse key={id} x={midX} y={midY} radiusX={Math.abs(w) / 2} radiusY={Math.abs(h) / 2} {...common} />;
    case 'rect':
      return <Rect key={id} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(w)} height={Math.abs(h)} {...common} />;
    case 'triangle':
      return <Line key={id} points={[midX, y1, x2, y2, x1, y2]} closed lineCap="round" lineJoin="round" {...common} />;
    case 'line':
      return <Line key={id} points={[x1, y1, x2, y2]} lineCap="round" {...common} />;
    case 'arrow':
      return <Arrow key={id} points={[x1, y1, x2, y2]} fill={color} stroke={color} strokeWidth={width} opacity={opacity / 100} pointerLength={12} pointerWidth={10} />;
    case 'diamond':
      return <Line key={id} points={[midX, y1, x2, midY, midX, y2, x1, midY]} closed lineCap="round" lineJoin="round" {...common} />;
    case 'star': {
      const outerR = Math.max(4, Math.min(Math.abs(w), Math.abs(h)) / 2);
      return <Star key={id} x={midX} y={midY} numPoints={5} innerRadius={outerR * 0.4} outerRadius={outerR} {...common} />;
    }
    default:
      return null;
  }
}

/* ── Component ────────────────────────────────────────────── */

const SolvitCanvas = forwardRef<SolvitCanvasHandle, Props>(
  ({ tool, color, strokeWidth, opacity = 100, shape = null, onLiveUpdate }, ref) => {
    const stageRef      = useRef<Konva.Stage>(null);
    const containerRef  = useRef<HTMLDivElement>(null);
    const [size, setSize]         = useState({ width: 800, height: 600 });
    const [elements, setElements] = useState<DrawElement[]>([]);
    const [editing, setEditing]   = useState<EditingText | null>(null);
    const currentEl     = useRef<DrawElement | null>(null);
    const isDown        = useRef(false);
    const liveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recognizedIds = useRef<Set<string>>(new Set());
    const history       = useHistory<DrawElement[]>([]);
    const hasCommitted    = useRef(false);
    const writeAnimRef    = useRef<ReturnType<typeof setInterval> | null>(null);

    // Resize observer
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const ro = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
      });
      ro.observe(container);
      setSize({ width: container.clientWidth, height: container.clientHeight });
      return () => ro.disconnect();
    }, []);

    // Keyboard undo/redo
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!(e.ctrlKey || e.metaKey) || e.key !== 'z') return;
        e.preventDefault();
        if (e.shiftKey) {
          const next = history.redo();
          if (next) setElements(next);
        } else {
          const prev = history.undo();
          if (prev !== null) setElements(prev);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [history]);

    const scheduleLiveUpdate = useCallback(() => {
      if (!onLiveUpdate) return;
      if (liveTimer.current) clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.draw();
        const img = stage.toDataURL({ mimeType: 'image/png' });
        if (img) onLiveUpdate(img);
      }, 400);
    }, [onLiveUpdate]);

    /* ── Text commit ──────────────────────────────────────── */

    const commitText = useCallback((current: EditingText | null) => {
      if (hasCommitted.current || !current || !current.value.trim()) {
        setEditing(null);
        return;
      }
      hasCommitted.current = true;
      const fontSize = Math.max(12, 10 + strokeWidth * 2);
      const el: TextElement = {
        kind: 'text',
        id: crypto.randomUUID(),
        x: current.x,
        y: current.y,
        text: current.value,
        color,
        fontSize,
        opacity,
      };
      setElements(prev => {
        const updated = [...prev, el];
        history.push(updated);
        return updated;
      });
      setEditing(null);
      scheduleLiveUpdate();
    }, [color, strokeWidth, opacity, history, scheduleLiveUpdate]);

    /* ── Pointer handlers ─────────────────────────────────── */

    const handlePointerDown = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = stageRef.current?.getPointerPosition();
      if (!pos) return;

      if (tool === 'text') {
        hasCommitted.current = false;
        setEditing({ x: pos.x, y: pos.y, value: '' });
        return;
      }

      isDown.current = true;

      if (shape) {
        const el: ShapeElement = {
          kind: 'shape', id: crypto.randomUUID(), shapeType: shape,
          x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
          color, width: strokeWidth, opacity,
        };
        currentEl.current = el;
        setElements(prev => [...prev, el]);
      } else {
        const el: StrokeElement = {
          kind: 'stroke', id: crypto.randomUUID(),
          points: [pos.x, pos.y],
          color, width: strokeWidth, tool, opacity,
        };
        currentEl.current = el;
        setElements(prev => [...prev, el]);
      }
    }, [color, strokeWidth, tool, opacity, shape]);

    const handlePointerMove = useCallback((_: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isDown.current || !currentEl.current) return;
      const pos = stageRef.current?.getPointerPosition();
      if (!pos) return;

      if (currentEl.current.kind === 'shape') {
        currentEl.current = { ...(currentEl.current as ShapeElement), x2: pos.x, y2: pos.y };
      } else {
        const s = currentEl.current as StrokeElement;
        currentEl.current = { ...s, points: [...s.points, pos.x, pos.y] };
      }

      setElements(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = currentEl.current!;
        return copy;
      });
      scheduleLiveUpdate();
    }, [scheduleLiveUpdate]);

    const handlePointerUp = useCallback(() => {
      if (!isDown.current || !currentEl.current) return;
      isDown.current = false;

      let finalEl: DrawElement;
      if (currentEl.current.kind === 'stroke') {
        const s = currentEl.current as StrokeElement;
        const simplified = rdpSimplify(flatToPoints(s.points), 1.5);
        finalEl = { ...s, points: pointsToFlat(simplified) };
      } else {
        finalEl = currentEl.current;
      }

      setElements(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = finalEl;
        history.push(updated);
        return updated;
      });
      currentEl.current = null;
      scheduleLiveUpdate();
    }, [history, scheduleLiveUpdate]);

    /* ── Imperative handle ────────────────────────────────── */

    useImperativeHandle(ref, () => ({
      getImageBase64: () => {
        const stage = stageRef.current;
        if (!stage) return '';
        stage.draw(); // flush any pending batched redraws before capturing
        return stage.toDataURL({ mimeType: 'image/png' });
      },
      exportStrokesForAPI: () => {
        const strokes = elements.filter((e): e is StrokeElement => e.kind === 'stroke');
        return strokesForAPI(strokes as any);
      },
      markRecognized: () => {
        recognizedIds.current = new Set(
          elements.filter(e => e.kind === 'stroke').map(e => e.id)
        );
      },
      getStrokeDelta: (): StrokeDelta => {
        const strokes = elements.filter((e): e is StrokeElement => e.kind === 'stroke');
        const newStrokes = strokes.filter(s => s.tool === 'pen' && !recognizedIds.current.has(s.id));
        const removedCount = [...recognizedIds.current].filter(id => !strokes.find(s => s.id === id)).length;
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
            normMinX: (minX / size.width) * 100, normMinY: (minY / size.height) * 100,
            normMaxX: (maxX / size.width) * 100, normMaxY: (maxY / size.height) * 100,
          };
        }
        return { newStrokeCount: newStrokes.length, removedStrokeCount: removedCount, changedRegion };
      },
      undo:    () => { const prev = history.undo(); if (prev !== null) setElements(prev); },
      redo:    () => { const next = history.redo(); if (next) setElements(next); },
      canUndo: () => history.canUndo(),
      canRedo: () => history.canRedo(),
      clear:   () => { history.push([]); setElements([]); },
      writeFormula: (latex: string) => {
        const text = latexToUnicode(latex);
        if (!text) return;
        if (writeAnimRef.current) clearInterval(writeAnimRef.current);

        const id = crypto.randomUUID();
        const fontSize = 26;
        const x = 40;
        const y = size.height * 0.75;

        const base: TextElement = { kind: 'text', id, x, y, text: '', color: '#7ed4a0', fontSize, opacity: 100 };
        setElements(prev => [...prev, base]);

        let i = 0;
        writeAnimRef.current = setInterval(() => {
          i++;
          setElements(prev => {
            const copy = [...prev];
            const idx = copy.findIndex(e => e.id === id);
            if (idx === -1) { clearInterval(writeAnimRef.current!); return copy; }
            copy[idx] = { ...(copy[idx] as TextElement), text: text.slice(0, i) };
            return copy;
          });
          if (i >= text.length) {
            clearInterval(writeAnimRef.current!);
            writeAnimRef.current = null;
            setElements(prev => { history.push(prev); return prev; });
          }
        }, 35);
      },
    }), [elements, size, history]);

    const cursor = tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair';
    const fontSize = Math.max(12, 10 + strokeWidth * 2);

    return (
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          style={{ touchAction: 'none', cursor }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <Layer>
            {elements.map(el => {
              if (el.kind === 'stroke') {
                return (
                  <Line
                    key={el.id}
                    points={el.points}
                    stroke={el.color}
                    strokeWidth={el.tool === 'eraser' ? el.width * 4 : el.width}
                    lineCap="round"
                    lineJoin="round"
                    tension={0.4}
                    opacity={el.tool === 'eraser' ? 1 : el.opacity / 100}
                    globalCompositeOperation={el.tool === 'eraser' ? 'destination-out' : 'source-over'}
                  />
                );
              }
              if (el.kind === 'text') {
                return (
                  <Text
                    key={el.id}
                    x={el.x}
                    y={el.y}
                    text={el.text}
                    fill={el.color}
                    fontSize={el.fontSize}
                    fontFamily="Segoe UI, sans-serif"
                    opacity={el.opacity / 100}
                  />
                );
              }
              return renderShape(el as ShapeElement);
            })}
          </Layer>
        </Stage>

        {/* Text editing overlay */}
        {editing && (
          <textarea
            autoFocus
            style={{
              position:    'absolute',
              left:        editing.x,
              top:         editing.y,
              background:  'transparent',
              border:      'none',
              outline:     '1.5px dashed rgba(126,212,160,0.7)',
              borderRadius: '2px',
              color:        color,
              fontSize:    `${fontSize}px`,
              fontFamily:  'Segoe UI, sans-serif',
              lineHeight:  '1.4',
              resize:      'none',
              minWidth:    '120px',
              padding:     '1px 3px',
              zIndex:      20,
              opacity:     opacity / 100,
              overflow:    'hidden',
            }}
            value={editing.value}
            onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
            onBlur={() => commitText(editing)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setEditing(null); }
              else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(editing); }
            }}
          />
        )}
      </div>
    );
  }
);

SolvitCanvas.displayName = 'SolvitCanvas';
export default SolvitCanvas;

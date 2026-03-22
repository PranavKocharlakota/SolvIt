import React from 'react';
import { DiagramType, FreeDiagram, DrawPrimitive } from '../lib/types';

interface DiagramRendererProps {
  diagram: DiagramType | null;
  onDismiss: () => void;
}

// ── Error Boundary ─────────────────────────────────────────────────────────────
interface EBState { error: string | null }
class DiagramErrorBoundary extends React.Component<React.PropsWithChildren<{ onDismiss: () => void }>, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(e: Error): EBState { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', bottom: 80, left: 20, background: '#450a0a',
          border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px',
          color: '#fca5a5', fontSize: 13, zIndex: 6, maxWidth: 340,
        }}>
          Diagram error: {this.state.error}
          <button onClick={() => { this.setState({ error: null }); this.props.onDismiss(); }}
            style={{ marginLeft: 10, background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Coordinate helpers ─────────────────────────────────────────────────────────
// Maps 0-100 coordinates to SVG viewBox (0 0 100 100) — 1:1, no scaling needed
// We use viewBox="0 0 100 100" so coords are literal.

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function clr(c: unknown, fallback = '#94a3b8'): string {
  return (typeof c === 'string' && c.startsWith('#')) ? c : fallback;
}

// ── Arrow helper ───────────────────────────────────────────────────────────────
function SvgArrow({ x1, y1, x2, y2, color, label, labelPos = 0.5, width = 2 }: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; label?: string; labelPos?: number; width?: number;
}) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!isFinite(len) || len < 0.5) return null;
  const ux = dx / len, uy = dy / len;
  // Arrowhead — scale relative to coordinate space
  const ah = Math.min(3.5, len * 0.35);
  const aw = ah * 0.55;
  const hx = x2 - ux * ah, hy = y2 - uy * ah;
  const p1x = hx - uy * aw, p1y = hy + ux * aw;
  const p2x = hx + uy * aw, p2y = hy - ux * aw;
  const lx = x1 + dx * labelPos - uy * 4;
  const ly = y1 + dy * labelPos + ux * 4;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`} fill={color} />
      {label && (
        <text x={lx} y={ly} fill={color} fontSize={3.5} textAnchor="middle" dominantBaseline="middle"
          style={{ fontWeight: 600 }}>
          {label}
        </text>
      )}
    </g>
  );
}

// ── Primitive renderer ─────────────────────────────────────────────────────────
function renderPrimitive(p: DrawPrimitive, i: number): React.ReactElement | null {
  switch (p.type) {
    case 'line': {
      const dashArr = p.dashed ? '2,1.5' : undefined;
      return <line key={i} x1={num(p.x1)} y1={num(p.y1)} x2={num(p.x2)} y2={num(p.y2)}
        stroke={clr(p.color)} strokeWidth={num(p.width, 1.5)} strokeLinecap="round"
        strokeDasharray={dashArr} />;
    }
    case 'arrow':
      return <SvgArrow key={i}
        x1={num(p.x1)} y1={num(p.y1)} x2={num(p.x2)} y2={num(p.y2)}
        color={clr(p.color, '#60a5fa')} label={p.label} labelPos={num(p.labelPos, 0.5)}
        width={num(p.width, 2)} />;

    case 'circle':
      return <circle key={i} cx={num(p.cx)} cy={num(p.cy)} r={num(p.r)}
        stroke={clr(p.color, '#60a5fa')} fill={p.fill === 'none' ? 'none' : clr(p.fill, 'none')}
        strokeWidth={num(p.width, 1.5)} />;

    case 'rect':
      return <rect key={i} x={num(p.x)} y={num(p.y)} width={num(p.w)} height={num(p.h)}
        stroke={clr(p.color, '#60a5fa')} fill={p.fill === 'none' ? 'none' : clr(p.fill, 'none')}
        strokeWidth={num(p.width, 1.5)} />;

    case 'text': {
      const anchor = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : 'start';
      return <text key={i} x={num(p.x)} y={num(p.y)} fill={clr(p.color, '#e2e8f0')}
        fontSize={num(p.size, 4)} textAnchor={anchor} dominantBaseline="middle"
        fontWeight={p.bold ? 700 : 400}>
        {String(p.content ?? '')}
      </text>;
    }

    case 'arc': {
      const cx = num(p.cx), cy = num(p.cy), r = num(p.r);
      const startRad = (num(p.startAngle) * Math.PI) / 180;
      const endRad = (num(p.endAngle) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const sweep = ((num(p.endAngle) - num(p.startAngle)) + 360) % 360;
      const large = sweep > 180 ? 1 : 0;
      if (!isFinite(x1 + y1 + x2 + y2)) return null;
      return <path key={i} d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        stroke={clr(p.color, '#fbbf24')} fill="none" strokeWidth={num(p.width, 1.5)} />;
    }

    case 'path': {
      const pts = (p.points ?? []).filter(pt => isFinite(num(pt.x)) && isFinite(num(pt.y)));
      if (pts.length < 2) return null;
      const d = pts.map((pt, pi) => `${pi === 0 ? 'M' : 'L'}${num(pt.x)},${num(pt.y)}`).join(' ')
        + (p.closed ? ' Z' : '');
      const dashArr = p.dashed ? '2,1.5' : undefined;
      return <path key={i} d={d}
        stroke={clr(p.color, '#4a9eff')}
        fill={p.fill === 'none' || !p.fill ? 'none' : clr(p.fill, 'none')}
        strokeWidth={num(p.width, 2)} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={dashArr} />;
    }

    default:
      return null;
  }
}

// ── Free diagram renderer ──────────────────────────────────────────────────────
function renderFree(d: FreeDiagram): React.ReactElement {
  const primitives = d.primitives ?? [];
  return (
    <>
      {d.title && (
        <text x={50} y={5.5} fill="#64748b" fontSize={3.5} textAnchor="middle">{d.title}</text>
      )}
      {primitives.map((p, i) => renderPrimitive(p, i))}
    </>
  );
}

// ── Legacy fallback (simplified) ───────────────────────────────────────────────
function renderLegacyFallback(diagram: DiagramType): React.ReactElement {
  return (
    <text x={50} y={50} fill="#f59e0b" fontSize={4} textAnchor="middle" dominantBaseline="middle">
      Legacy diagram type: {(diagram as any).type}
    </text>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function DiagramSVG({ diagram, onDismiss }: { diagram: DiagramType; onDismiss: () => void }) {
  const content = diagram.type === 'free'
    ? renderFree(diagram as FreeDiagram)
    : renderLegacyFallback(diagram);

  return (
    <>
      <button onClick={onDismiss} style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 7,
        background: '#1e293b', border: '1px solid #334155', color: '#64748b',
        borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
      }}>
        ✕ Clear diagram
      </button>
      <svg
        style={{
          position: 'fixed', top: 48, left: 0,
          width: 'calc(100vw - 320px)', height: 'calc(100vh - 48px)',
          pointerEvents: 'none', zIndex: 6,
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dark panel background */}
        <rect x={1} y={1} width={98} height={98} fill="rgba(10,15,30,0.88)" stroke="#1e3a5f" strokeWidth={0.4} rx={2} />
        {content}
      </svg>
    </>
  );
}

export default function DiagramRenderer({ diagram, onDismiss }: DiagramRendererProps) {
  if (!diagram) return null;
  return (
    <DiagramErrorBoundary onDismiss={onDismiss}>
      <DiagramSVG diagram={diagram} onDismiss={onDismiss} />
    </DiagramErrorBoundary>
  );
}

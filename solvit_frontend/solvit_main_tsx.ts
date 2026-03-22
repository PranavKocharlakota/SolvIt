import React, { useState, useRef } from "react";
import "./Solvit.css";

import type { BoardMode, ToolId, BrushId, HighlighterId } from "./types";
import { TOOLS, SIDE_ICONS, COLORS, HIGHLIGHTERS, BOARD_MODES, DEMO_MESSAGES } from "./constants";
import { useBoard, getBoardStyles } from "./useBoard";
import {
  BoardPreview, ZoomBtn, ITBtn, ChatMsg,
  ClearModal, NotebookLines, DrawingLayer,
} from "./components";

export default function Solvit() {
  /* ── State ─────────────────────────────────────────────── */
  const [activeTool,        setActiveTool]        = useState<ToolId>("pen");
  const [activeSide,        setActiveSide]        = useState("brush");
  const [activeBrush,       setActiveBrush]       = useState<BrushId>("pen");
  const [activeColor,       setActiveColor]       = useState("#1a1a1a");
  const [activeHL,          setActiveHL]          = useState<HighlighterId | null>(null);
  const [boardMode,         setBoardMode]         = useState<BoardMode>("chalkboard");
  const [strokeSize,        setStrokeSize]        = useState(4);
  const [opacity,           setOpacity]           = useState(100);
  const [zoom,              setZoom]              = useState(100);
  const [showClearConfirm,  setShowClearConfirm]  = useState(false);
  const [cleared,           setCleared]           = useState(false);

  /* ── Refs ──────────────────────────────────────────────── */
  const canvasRef  = useRef<HTMLDivElement>(null);
  const cbgRef     = useRef<SVGSVGElement>(null);
  const drawingRef = useRef<SVGGElement>(null);

  /* ── Board hook ────────────────────────────────────────── */
  useBoard({ boardMode, canvasRef, cbgRef, drawingRef });
  const { bg, hint, badge } = getBoardStyles(boardMode);

  /* ── Helpers ───────────────────────────────────────────── */
  const dotSize = Math.min(strokeSize * 2, 30);

  return (
    <div className="app">

      {/* ── TOPBAR ─────────────────────────────────────────── */}
      <div className="topbar">
        <div className="logo">Solv<span>it</span></div>
        <div className="tb-sep" />

        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.title}
            className={`tb-btn${activeTool === t.id ? " active" : ""}`}
            onClick={() => setActiveTool(t.id)}
          >
            {t.icon}
          </button>
        ))}

        <div className="tb-sep" />

        <button
          className={`tb-btn${activeTool === "undo" ? " active" : ""}`}
          onClick={() => setActiveTool("undo")}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
          </svg>
        </button>
        <button
          className={`tb-btn${activeTool === "redo" ? " active" : ""}`}
          onClick={() => setActiveTool("redo")}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-.49-3.28"/>
          </svg>
        </button>

        <div className="tb-spacer" />
        <div className="session-tag">Physics — Session 3</div>
        <button className="clear-btn" onClick={() => setShowClearConfirm(true)}>Clear board</button>
        <button className="share-btn">Share</button>
      </div>

      {/* ── SIDE ICONS ─────────────────────────────────────── */}
      <div className="side-icons">
        {SIDE_ICONS.map(s =>
          s.divider
            ? <div key={s.id} className="si-divider" />
            : (
              <button
                key={s.id}
                className={`si-btn${activeSide === s.id ? " active" : ""}`}
                onClick={() => setActiveSide(s.id)}
              >
                {s.icon}
              </button>
            )
        )}
      </div>

      {/* ── TOOL PANEL ─────────────────────────────────────── */}
      <div className="tool-panel">

        {/* Brush type */}
        <div>
          <span className="tp-label">Brush</span>
          <div className="brush-row">
            {(["pen", "marker"] as BrushId[]).map(id => (
              <button
                key={id}
                className={`brush-btn${activeBrush === id ? " active" : ""}`}
                onClick={() => setActiveBrush(id)}
              >
                {id === "pen"
                  ? <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                  : <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="2" y="7" width="20" height="10" rx="3"/></svg>
                }
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Color swatches */}
        <div>
          <span className="tp-label">Color</span>
          <div className="color-grid">
            {COLORS.map(c => (
              <div
                key={c}
                className={`color-swatch${activeColor === c ? " active" : ""}`}
                style={{ background: c }}
                onClick={() => setActiveColor(c)}
              />
            ))}
          </div>
        </div>

        {/* Stroke size */}
        <div className="sl-wrap">
          <div className="sl-header">
            <span className="tp-label" style={{ marginBottom: 0 }}>Stroke</span>
            <span className="sl-value">{strokeSize}px</span>
          </div>
          <input
            type="range" min="1" max="24" step="1"
            value={strokeSize}
            className="stroke-range"
            onChange={e => setStrokeSize(+e.target.value)}
          />
          <div className="preview-dot-wrap">
            <div
              className="preview-dot"
              style={{ background: activeColor, width: dotSize, height: dotSize }}
            />
          </div>
        </div>

        {/* Opacity */}
        <div className="sl-wrap">
          <div className="sl-header">
            <span className="tp-label" style={{ marginBottom: 0 }}>Opacity</span>
            <span className="sl-value">{opacity}%</span>
          </div>
          <input
            type="range" min="10" max="100" step="1"
            value={opacity}
            className="stroke-range"
            onChange={e => setOpacity(+e.target.value)}
          />
        </div>

        {/* Highlighters */}
        <div>
          <span className="tp-label">Highlighter</span>
          <div className="hl-row">
            {HIGHLIGHTERS.map(h => (
              <button
                key={h.id}
                className={`hl-btn${activeHL === h.id ? " active" : ""}`}
                style={{ background: h.color, borderColor: h.border }}
                onClick={() => setActiveHL(activeHL === h.id ? null : h.id)}
              />
            ))}
          </div>
        </div>

        {/* Board style */}
        <div>
          <span className="tp-label">Board style</span>
          <div className="board-switcher">
            {BOARD_MODES.map(m => (
              <button
                key={m.id}
                className={`board-opt${boardMode === m.id ? " active" : ""}`}
                onClick={() => setBoardMode(m.id)}
              >
                <BoardPreview mode={m.id} />
                <span className="board-opt-label">{m.label}</span>
                <div className="board-active-dot" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CANVAS ─────────────────────────────────────────── */}
      <div ref={canvasRef} className="canvas" style={{ background: bg }}>
        <svg ref={cbgRef} className="canvas-bg-svg" xmlns="http://www.w3.org/2000/svg" />

        <div className="hint-pill" style={hint}>
          Draw anything — highlight in red for Echo to solve
        </div>
        <div className="board-badge" style={badge}>
          {boardMode.charAt(0).toUpperCase() + boardMode.slice(1)}
        </div>

        {!cleared && <DrawingLayer ref={drawingRef} />}

        {!cleared && (
          <div className="selection-box">
            <div className="sel-handle" style={{ top: -3, left:  -3 }} />
            <div className="sel-handle" style={{ top: -3, right: -3 }} />
            <div className="sel-handle" style={{ bottom: -3, left:  -3 }} />
            <div className="sel-handle" style={{ bottom: -3, right: -3 }} />
            <div className="sel-tag">Ask Echo</div>
          </div>
        )}

        <div className="zoom-bar">
          <ZoomBtn label="−" onClick={() => setZoom(z => Math.max(25,  z - 25))} />
          <span className="zoom-value">{zoom}%</span>
          <ZoomBtn label="+" onClick={() => setZoom(z => Math.min(200, z + 25))} />
          <ZoomBtn label="Fit" onClick={() => setZoom(100)} small />
        </div>

        {showClearConfirm && (
          <ClearModal
            onConfirm={() => { setCleared(true); setShowClearConfirm(false); }}
            onCancel={() => setShowClearConfirm(false)}
          />
        )}
      </div>

      {/* ── ECHO PANEL ─────────────────────────────────────── */}
      <div className="ai-panel">
        <NotebookLines />

        <div className="ai-header">
          <div className="echo-avatar">Ec</div>
          <div>
            <div className="echo-name">Echo</div>
            <div className="echo-status">
              <div className="status-dot" />
              Ready
            </div>
          </div>
        </div>

        <div className="ai-messages">
          {DEMO_MESSAGES.map((m, i) => <ChatMsg key={i} msg={m} />)}
        </div>

        <div className="chips">
          {["Step by step", "Draw it", "Formula", "Verify"].map(c => (
            <div key={c} className="chip">{c}</div>
          ))}
        </div>

        <div className="ai-input-area">
          <div className="input-label">— notes to Echo —</div>
          <div className="input-tools">
            <ITBtn icon={<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>} />
            <ITBtn icon={<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>} />
            <ITBtn icon={<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>} />
            <span className="sel-indicator">Matrix A attached</span>
          </div>
          <div className="input-row">
            <textarea
              className="ai-textarea"
              placeholder="Ask Echo or describe what to draw..."
            />
            <button className="send-btn">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#7ed4a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

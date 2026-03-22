import React, { useState, useRef, useCallback, useEffect } from "react";
import "./Solvit.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import LandingPage from "./LandingPage";

import type { BoardMode, ToolId, BrushId, HighlighterId, ShapeId } from "./types";
import { TOOLS, SIDE_ICONS, COLORS, HIGHLIGHTERS, BOARD_MODES, SHAPES } from "./constants";
import { useBoard, getBoardStyles } from "./useBoard";
import {
  BoardPreview, ClearModal, NotebookLines,
} from "./components";
import SolvitCanvas, { SolvitCanvasHandle } from "./SolvitCanvas";
import { describeDrawing, recognizeDrawing, solveProblem } from "../lib/api";
import { RecognitionResult, Step } from "../lib/types";

/* ── Echo message types ───────────────────────────────── */
interface EchoMsg {
  role: "ai" | "user";
  text?: string;
  steps?: Step[];
  recognition?: RecognitionResult;
  time: string;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Solvit() {
  const [showLanding, setShowLanding] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const handleEnterApp = () => {
    setIsExiting(true);
    setTimeout(() => {
      setShowLanding(false);
      setIsExiting(false);
    }, 600);
  };

  if (showLanding) {
    return (
      <div className={isExiting ? "landing-page exit" : ""}>
        <LandingPage onEnter={handleEnterApp} />
      </div>
    );
  }

  return <SolvitApp />;
}

function SolvitApp() {
  /* ── Tool / board state ────────────────────────────────── */
  const [activeTool,       setActiveTool]       = useState<ToolId>("pen");
  const [activeSide,       setActiveSide]       = useState("brush");
  const [activeBrush,      setActiveBrush]      = useState<BrushId>("pen");
  const [activeColor,      setActiveColor]      = useState("#1a1a1a");
  const [activeHL,         setActiveHL]         = useState<HighlighterId | null>(null);
  const [boardMode,        setBoardMode]        = useState<BoardMode>("chalkboard");
  const [strokeSize,       setStrokeSize]       = useState(4);
  const [opacity,          setOpacity]          = useState(100);
  const [showClearConfirm,  setShowClearConfirm]  = useState(false);
  const [showToolPanel,     setShowToolPanel]     = useState(true);
  const [showShapesPicker,  setShowShapesPicker]  = useState(false);
  const [activeShape,       setActiveShape]       = useState<ShapeId | null>(null);

  /* ── AI state ──────────────────────────────────────────── */
  const [messages,     setMessages]     = useState<EchoMsg[]>([
    { role: "ai", text: "Hi! I'm Echo. Draw anything on the board and click Solve, or ask me a question.", time: now() },
  ]);
  const [recognition,  setRecognition]  = useState<RecognitionResult | null>(null);
  const [liveDesc,     setLiveDesc]     = useState<string | null>(null);
  const [loading,      setLoading]      = useState({ recognize: false, solve: false, live: false });
  const [input,        setInput]        = useState("");

  /* ── Close shapes picker on outside click ──────────────── */
  useEffect(() => {
    if (!showShapesPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.shapes-picker') && !target.closest('.si-btn')) {
        setShowShapesPicker(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showShapesPicker]);

  /* ── Echo panel resize ─────────────────────────────────── */
  const [echoWidth, setEchoWidth] = useState(255);
  const isResizing  = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current  = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = echoWidth;
    e.preventDefault();
  }, [echoWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = resizeStartX.current - e.clientX;
      setEchoWidth(Math.max(180, Math.min(520, resizeStartW.current + delta)));
    };
    const onUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ── Refs ──────────────────────────────────────────────── */
  const canvasRef    = useRef<SolvitCanvasHandle>(null);
  const canvasDiv    = useRef<HTMLDivElement>(null);
  const cbgRef       = useRef<SVGSVGElement>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);

  /* ── Board hook (background textures) ─────────────────── */
  // useBoard needs drawingRef; we pass a dummy ref since DrawingLayer is gone
  const dummyDrawingRef = useRef<SVGGElement>(null);
  useBoard({ boardMode, canvasRef: canvasDiv, cbgRef, drawingRef: dummyDrawingRef });
  const { bg, hint, badge } = getBoardStyles(boardMode);

  /* ── Derived canvas props ──────────────────────────────── */
  const canvasTool = (
    activeTool === "eraser" ? "eraser" : "pen"
  ) as "pen" | "eraser";
  const dotSize    = Math.min(strokeSize * 2, 30);

  // Effective drawing properties (highlighter / marker override base values)
  const activeHLDef      = activeHL ? HIGHLIGHTERS.find(h => h.id === activeHL) : null;
  const effectiveColor   = activeHLDef ? activeHLDef.color : activeColor;
  const effectiveOpacity = activeHLDef ? 100 : opacity; // HL color already has built-in alpha
  const effectiveWidth   = activeHLDef
    ? strokeSize * 5                              // highlighter is thick
    : activeBrush === "marker"
      ? strokeSize * 2                            // marker is thick
      : strokeSize;                               // pen = normal

  /* ── Live description ──────────────────────────────────── */
  const handleLiveUpdate = useCallback(async (imageBase64: string) => {
    setLoading(l => ({ ...l, live: true }));
    try {
      const desc = await describeDrawing(imageBase64);
      setLiveDesc(desc);
    } catch { /* silent */ }
    finally { setLoading(l => ({ ...l, live: false })); }
  }, []);

  /* ── Scroll Echo to bottom ─────────────────────────────── */
  const scrollChat = useCallback(() => {
    setTimeout(() => {
      const container = chatEndRef.current?.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  }, []);

  /* ── Recognize + Solve ─────────────────────────────────── */
  const handleSolve = useCallback(async () => {
    if (!canvasRef.current) return;
    const delta = canvasRef.current.getStrokeDelta();
    const hasDelta = delta && (delta.newStrokeCount > 0 || delta.removedStrokeCount > 0);

    // If nothing changed, skip re-recognizing and just solve with cached recognition
    if (!hasDelta && recognition) {
      setLoading(l => ({ ...l, solve: true }));
      const answer = await solveProblem(recognition);
      setLoading(l => ({ ...l, solve: false }));
      setMessages(m => [...m, {
        role: "ai",
        text: answer.text ?? undefined,
        steps: answer.steps ?? undefined,
        time: now(),
      }]);
      scrollChat();
      return;
    }

    const imageBase64   = canvasRef.current.getImageBase64();
    const strokes       = canvasRef.current.exportStrokesForAPI();

    try {
      setLoading(l => ({ ...l, recognize: true }));
      setMessages(m => [...m, { role: "ai", text: "Analyzing your drawing…", time: now() }]);
      scrollChat();

      const result = await recognizeDrawing(imageBase64, strokes, hasDelta ? delta : undefined);
      setRecognition(result);
      canvasRef.current.markRecognized();
      setLoading(l => ({ ...l, recognize: false, solve: true }));

      if (result.latex) {
        setMessages(m => [...m, {
          role: "ai",
          recognition: result,
          time: now(),
        }]);
        scrollChat();
      }

      const answer = await solveProblem(result);
      setLoading(l => ({ ...l, solve: false }));

      setMessages(m => [...m, {
        role: "ai",
        text: answer.text ?? undefined,
        steps: answer.steps ?? undefined,
        time: now(),
      }]);
      scrollChat();
    } catch (err: any) {
      setLoading({ recognize: false, solve: false, live: false });
      setMessages(m => [...m, { role: "ai", text: `Error: ${err.message}`, time: now() }]);
      scrollChat();
    }
  }, [scrollChat]);

  /* ── Follow-up chat ────────────────────────────────────── */
  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");

    setMessages(m => [...m, { role: "user", text, time: now() }]);
    scrollChat();

    if (!recognition) {
      // No prior recognition — treat as a solve request
      await handleSolve();
      return;
    }

    try {
      setMessages(m => [...m, { role: "ai", text: "Thinking…", time: now() }]);
      scrollChat();
      const answer = await solveProblem(recognition, text);
      setMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "ai",
          text: answer.text ?? undefined,
          steps: answer.steps ?? undefined,
          time: now(),
        };
        return copy;
      });
      scrollChat();
    } catch (err: any) {
      setMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "ai", text: `Error: ${err.message}`, time: now() };
        return copy;
      });
    }
  }, [input, recognition, handleSolve, scrollChat]);

  /* ── Undo / Redo / Clear ───────────────────────────────── */
  const handleUndo  = () => canvasRef.current?.undo();
  const handleRedo  = () => canvasRef.current?.redo();
  const handleClear = () => { canvasRef.current?.clear(); setShowClearConfirm(false); };

  return (
    <div className="app" style={{ gridTemplateColumns: `42px ${showToolPanel ? '155px' : '0px'} 1fr ${echoWidth}px` }}>

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

        <button className="tb-btn" title="Undo" onClick={handleUndo}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.28"/>
          </svg>
        </button>
        <button className="tb-btn" title="Redo" onClick={handleRedo}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-.49-3.28"/>
          </svg>
        </button>

        <div className="tb-spacer" />

        <div className="session-tag">Echo AI</div>
        <button className="clear-btn" onClick={() => setShowClearConfirm(true)}>Clear board</button>
        <button
          className="share-btn"
          onClick={handleSolve}
          disabled={loading.recognize || loading.solve}
          title="Updates the AI's context to your current drawing"
        >
          {loading.recognize ? "Reading…" : loading.solve ? "Solving…" : "Solve ✦"}
        </button>
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
                onClick={() => {
                  setActiveSide(s.id);
                  if (s.id === "brush") {
                    setShowToolPanel(p => !p);
                    setShowShapesPicker(false);
                    setActiveShape(null);
                    setActiveTool("pen");
                  } else if (s.id === "eraser") {
                    setActiveTool("eraser");
                    setShowToolPanel(false);
                    setShowShapesPicker(false);
                    setActiveShape(null);
                  } else if (s.id === "shapes") {
                    setShowShapesPicker(p => !p);
                    setActiveTool("pen");
                  }
                }}
              >
                {s.icon}
              </button>
            )
        )}
      </div>

      {/* ── SHAPES PICKER ──────────────────────────────────── */}
      {showShapesPicker && (
        <div className="shapes-picker">
          {SHAPES.map(shape => (
            <button
              key={shape.id}
              className={`shape-btn${activeShape === shape.id ? " active" : ""}`}
              title={shape.label}
              onClick={() => { setActiveShape(prev => prev === shape.id ? null : shape.id); setShowShapesPicker(false); }}
            >
              {shape.icon}
              <span className="shape-label">{shape.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── TOOL PANEL ─────────────────────────────────────── */}
      <div className="tool-panel" style={{ overflow: 'hidden' }}>

        <div>
          <span className="tp-label">Brush</span>
          <div className="brush-row">
            {(["pen", "marker", "eraser"] as (BrushId | "eraser")[]).map(id => (
              <button
                key={id}
                className={`brush-btn${(id === "eraser" ? activeTool === "eraser" : activeTool !== "eraser" && activeBrush === id) ? " active" : ""}`}
                onClick={() => {
                  if (id === "eraser") {
                    setActiveTool("eraser");
                  } else {
                    setActiveBrush(id as BrushId);
                    setActiveTool("pen");
                  }
                }}
              >
                {id === "pen"
                  ? <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                  : id === "marker"
                  ? <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="2" y="7" width="20" height="10" rx="3"/></svg>
                  : <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 19l16-16M9 3L3 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6z"/></svg>
                }
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </div>
        </div>

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
            <div className="preview-dot" style={{ background: effectiveColor, width: dotSize, height: dotSize, opacity: effectiveOpacity / 100 }} />
          </div>
        </div>

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
      <div ref={canvasDiv} className="canvas" style={{ background: bg }}>
        <svg ref={cbgRef} className="canvas-bg-svg" xmlns="http://www.w3.org/2000/svg" />

        {!(liveDesc || loading.live) && (
          <div className="hint-pill" style={hint}>
            Draw anything — click <strong>Solve ✦</strong> for Echo to explain
          </div>
        )}

        {(liveDesc || loading.live) && (
          <div className="live-pill">
            <span className={`live-dot${loading.live ? " pulse" : ""}`} />
            <span>{loading.live ? "Reading…" : liveDesc}</span>
          </div>
        )}
        <div className="board-badge" style={badge}>
          {boardMode.charAt(0).toUpperCase() + boardMode.slice(1)}
        </div>

        <SolvitCanvas
          ref={canvasRef}
          tool={canvasTool}
          color={effectiveColor}
          strokeWidth={effectiveWidth}
          opacity={effectiveOpacity}
          shape={activeShape}
          boardMode={boardMode}
          onLiveUpdate={handleLiveUpdate}
        />

        {showClearConfirm && (
          <ClearModal
            onConfirm={handleClear}
            onCancel={() => setShowClearConfirm(false)}
          />
        )}
      </div>

      {/* ── ECHO PANEL ─────────────────────────────────────── */}
      <div className="ai-panel">
        <div className="echo-resize-handle" onMouseDown={handleResizeStart} />
        <NotebookLines />

        <div className="ai-header">
          <div className="echo-avatar">Ec</div>
          <div>
            <div className="echo-name">Echo</div>
            <div className="echo-status">
              <div className={`status-dot${(loading.recognize || loading.solve) ? " busy" : ""}`} />
              {loading.recognize ? "Reading board…" : loading.solve ? "Solving…" : "Ready"}
            </div>
          </div>
        </div>

        <div className="ai-messages">
          {messages.map((m, i) => (
            <EchoMessage key={i} msg={m} />
          ))}
          <div ref={chatEndRef} />
        </div>

        <form className="ai-input-area" onSubmit={handleSend}>
          <div className="input-label">— notes to Echo —</div>
          <div className="input-tools">
            <span className="sel-indicator">{recognition ? recognition.content_type : "nothing recognized yet"}</span>
          </div>
          <div className="input-row">
            <textarea
              className="ai-textarea"
              placeholder={recognition ? "Ask a follow-up…" : "Ask Echo or click Solve ✦"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e as any); } }}
            />
            <button type="submit" className="send-btn">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#7ed4a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

/* ── Strip LaTeX artifacts from plain text fields ──────── */
function cleanText(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '')   // remove display math blocks
    .replace(/\$([^$\n]*)\$/g, '$1')     // strip $ delimiters, keep content
    .replace(/\$/g, '')                  // remove any leftover dollar signs
    .trim();
}

function renderBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

/* ── Math renderer ─────────────────────────────────────── */
function MathBlock({ latex, display = false }: { latex: string; display?: boolean }) {
  let html = "";
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: display, output: "html" });
  } catch {
    html = latex;
  }
  return (
    <span
      className={display ? "math-block-display" : "math-block-inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* ── Echo message renderer ─────────────────────────────── */
function EchoMessage({ msg }: { msg: EchoMsg }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const isUser = msg.role === "user";

  return (
    <div className={`msg ${isUser ? "user" : "ai"}`}>
      {msg.text && <div className="bubble">{renderBold(cleanText(msg.text))}</div>}

      {msg.recognition?.latex && (
        <div className="math-block-wrap">
          <MathBlock latex={msg.recognition.latex} display />
        </div>
      )}

      {msg.steps && msg.steps.length > 0 && (
        <div className="steps-list">
          {msg.steps.map(step => (
            <div key={step.stepNumber} className="step-item">
              <button
                className="step-header"
                onClick={() => setExpanded(expanded === step.stepNumber ? null : step.stepNumber)}
              >
                <span className="step-num">{step.stepNumber}</span>
                <span className="step-preview">
                  {cleanText(step.explanation).slice(0, 60)}{cleanText(step.explanation).length > 60 ? "…" : ""}
                </span>
                <span className="step-chevron">{expanded === step.stepNumber ? "▲" : "▼"}</span>
              </button>
              {expanded === step.stepNumber && (
                <div className="step-body">
                  <p>{renderBold(cleanText(step.explanation))}</p>
                  {step.equation && (
                    <div className="math-block-wrap">
                      <MathBlock latex={step.equation} display />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="msg-time">{msg.time}</div>
    </div>
  );
}

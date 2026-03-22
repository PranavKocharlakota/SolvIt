import { useEffect, useCallback, RefObject } from "react";
import type { BoardMode } from "./types";
import { LIGHT_MAP } from "./constants";

interface UseBoardProps {
  boardMode: BoardMode;
  canvasRef: RefObject<HTMLDivElement>;
  cbgRef: RefObject<SVGSVGElement>;
  drawingRef: RefObject<SVGGElement>;
}

export function useBoard({ boardMode, canvasRef, cbgRef, drawingRef }: UseBoardProps) {

  const drawScratches = useCallback(() => {
    const svg = cbgRef.current;
    if (!svg) return;
    const w = svg.clientWidth, h = svg.clientHeight;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const len = Math.random() * 32 + 4, a = (Math.random() - 0.5) * 0.5;
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", String(x));
      l.setAttribute("y1", String(y));
      l.setAttribute("x2", String(x + Math.cos(a) * len));
      l.setAttribute("y2", String(y + Math.sin(a) * len));
      l.setAttribute("stroke", `rgba(255,255,255,${(Math.random() * 0.07 + 0.02).toFixed(3)})`);
      l.setAttribute("stroke-width", "0.6");
      l.setAttribute("stroke-linecap", "round");
      svg.appendChild(l);
    }
  }, [cbgRef]);

  const drawGrid = useCallback(() => {
    const svg = cbgRef.current;
    if (!svg) return;
    const w = svg.clientWidth, h = svg.clientHeight, s = 28;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (let x = 0; x <= w; x += s) {
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", String(x)); l.setAttribute("y1", "0");
      l.setAttribute("x2", String(x)); l.setAttribute("y2", String(h));
      l.setAttribute("stroke", "#c0d8f0"); l.setAttribute("stroke-width", "0.6");
      svg.appendChild(l);
    }
    for (let y = 0; y <= h; y += s) {
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", "0"); l.setAttribute("y1", String(y));
      l.setAttribute("x2", String(w)); l.setAttribute("y2", String(y));
      l.setAttribute("stroke", "#c0d8f0"); l.setAttribute("stroke-width", "0.6");
      svg.appendChild(l);
    }
  }, [cbgRef]);

  const drawPaper = useCallback(() => {
    const svg = cbgRef.current;
    if (!svg) return;
    const w = svg.clientWidth, h = svg.clientHeight;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (let y = 28; y < h; y += 24) {
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", "0"); l.setAttribute("y1", String(y));
      l.setAttribute("x2", String(w)); l.setAttribute("y2", String(y));
      l.setAttribute("stroke", "#d4c89a"); l.setAttribute("stroke-width", "0.8");
      svg.appendChild(l);
    }
    const m = document.createElementNS("http://www.w3.org/2000/svg", "line");
    m.setAttribute("x1", "40"); m.setAttribute("y1", "0");
    m.setAttribute("x2", "40"); m.setAttribute("y2", String(h));
    m.setAttribute("stroke", "#f0a090"); m.setAttribute("stroke-width", "1.2");
    m.setAttribute("opacity", "0.5");
    svg.appendChild(m);
  }, [cbgRef]);

  const origStrokes = new Map<Element, string>();
  const origFills   = new Map<Element, string>();

  const adaptStrokes = useCallback((isDark: boolean) => {
    const g = drawingRef.current;
    if (!g) return;
    g.querySelectorAll("[stroke]").forEach((el) => {
      const s = el.getAttribute("stroke") ?? "";
      if (isDark) {
        const o = origStrokes.get(el);
        if (o) el.setAttribute("stroke", o);
      } else {
        if (!origStrokes.has(el)) origStrokes.set(el, s);
        const mapped = LIGHT_MAP[s];
        if (mapped) el.setAttribute("stroke", mapped);
      }
    });
    g.querySelectorAll("[fill]").forEach((el) => {
      const f = el.getAttribute("fill") ?? "";
      if (isDark) {
        const o = origFills.get(el);
        if (o) el.setAttribute("fill", o);
      } else {
        if (!origFills.has(el)) origFills.set(el, f);
        if (f === "#e8f5e8") el.setAttribute("fill", "#1a3a2a");
      }
    });
  }, [drawingRef]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (boardMode === "chalkboard") { drawScratches(); adaptStrokes(true);  }
      if (boardMode === "grid")       { drawGrid();      adaptStrokes(false); }
      if (boardMode === "paper")      { drawPaper();     adaptStrokes(false); }
    }, 60);
    return () => clearTimeout(timer);
  }, [boardMode, drawScratches, drawGrid, drawPaper, adaptStrokes]);
}

/* ── Board-mode derived styles ─────────────────────────── */
export function getBoardStyles(mode: BoardMode) {
  const bg = mode === "chalkboard" ? "#2a4a2a" : mode === "grid" ? "#ffffff" : "#fdfaf3";

  const hint =
    mode === "chalkboard"
      ? { background:"rgba(0,0,0,0.45)",   border:"1px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.5)" }
      : mode === "grid"
      ? { background:"rgba(0,0,0,0.07)",   border:"1px solid rgba(0,0,0,0.12)",       color:"rgba(0,0,0,0.4)" }
      : { background:"rgba(0,0,0,0.06)",   border:"1px solid rgba(180,160,100,0.3)",   color:"rgba(80,60,20,0.45)" };

  const badge =
    mode === "chalkboard"
      ? { background:"rgba(126,212,160,0.18)", color:"#7ed4a0", border:"1px solid rgba(126,212,160,0.3)" }
      : mode === "grid"
      ? { background:"rgba(55,138,221,0.12)",  color:"#185fa5", border:"1px solid rgba(55,138,221,0.25)" }
      : { background:"rgba(186,117,23,0.12)",  color:"#854f0b", border:"1px solid rgba(186,117,23,0.25)" };

  return { bg, hint, badge };
}

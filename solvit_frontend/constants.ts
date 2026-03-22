import React from "react";
import type { ToolDef, SideIconDef, HighlighterDef, BoardModeDef, Message } from "./types";

export const COLORS: string[] = [
  "#1a1a1a","#ff5c5c","#5bc8f5","#f5c842","#7ed4a0",
  "#ff9f40","#c084fc","#f472b6","#7c4a1e","#a3e635",
];

export const LIGHT_MAP: Record<string, string> = {
  "#e8f5e8":                    "#1a3a2a",
  "rgba(232,245,232,0.45)":     "rgba(30,60,40,0.45)",
  "rgba(232,245,232,0.3)":      "rgba(30,60,40,0.3)",
  "rgba(232,245,232,0.55)":     "rgba(30,60,40,0.55)",
  "rgba(163,230,53,0.3)":       "rgba(60,120,20,0.4)",
};

export const TOOLS: ToolDef[] = [
  {
    id: "pen", title: "Pen",
    icon: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  },
  {
    id: "arrow", title: "Arrow",
    icon: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  },
  {
    id: "select", title: "Select",
    icon: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-7 1-3 6z"/></svg>,
  },
  {
    id: "text", title: "Text",
    icon: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  },
  {
    id: "eraser", title: "Eraser",
    icon: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l11-11 7 7-1 8z"/><line x1="6.34" y1="15.34" x2="17.66" y2="4.34"/></svg>,
  },
];

export const SIDE_ICONS: SideIconDef[] = [
  { id:"brush",     icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg> },
  { id:"shapes",    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/></svg> },
  { id:"layers",    icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> },
  { id:"divider1",  divider: true },
  { id:"templates", icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
  { id:"history",   icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { id:"divider2",  divider: true },
  { id:"settings",  icon: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34L8.5 6.34A7 7 0 1 1 5 12H2a10 10 0 1 0 17.07-7.07z"/></svg> },
];

export const HIGHLIGHTERS: HighlighterDef[] = [
  { id: "yellow", color: "rgba(255,230,50,0.7)",  border: "rgba(255,220,0,0.5)"  },
  { id: "red",    color: "rgba(255,80,80,0.7)",   border: "rgba(255,60,60,0.5)"  },
  { id: "green",  color: "rgba(80,220,120,0.7)",  border: "rgba(50,200,90,0.5)"  },
];

export const BOARD_MODES: BoardModeDef[] = [
  { id: "chalkboard", label: "Chalkboard" },
  { id: "grid",       label: "Grid"       },
  { id: "paper",      label: "Paper"      },
];

export const DEMO_MESSAGES: Message[] = [
  { role:"ai",   text:"Hi! I'm Echo. Highlight anything in red and I'll solve it.", time:"just now" },
  { role:"user", text:"Solve u — projection of v onto x-axis. Also eigenvalues of the red matrix.", time:"12:04 pm" },
  { role:"ai",   text:"Projection of v = (3,2) onto x-axis:", math:["u = (3, 0),  |u| = 3"], extra:"Eigenvalues of A:", math2:["det(A−λI)=0","(2−λ)(3−λ)=0","λ₁=2, λ₂=3"], time:"12:04 pm" },
  { role:"user", text:"Draw u on the board!", time:"12:05 pm" },
  { role:"ai",   text:"Drawing u = (3,0) as a green arrow now.", time:"12:05 pm" },
];

import React from "react";
import type { Message, BoardMode } from "./types";

/* ─── BoardPreview (small thumbnail in board switcher) ─── */
export function BoardPreview({ mode }: { mode: BoardMode }) {
  return (
    <div className="board-preview" style={{ background: mode === "chalkboard" ? "#2a4a2a" : mode === "grid" ? "#fff" : "#fdfaf3" }}>
      {mode === "grid" && (
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pg" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M5 0H0V5" fill="none" stroke="#c0d8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pg)" />
        </svg>
      )}
      {mode === "paper" && (
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="6"  x2="100%" y2="6"  stroke="#d4c89a" strokeWidth="0.8" />
          <line x1="0" y1="12" x2="100%" y2="12" stroke="#d4c89a" strokeWidth="0.8" />
          <line x1="0" y1="18" x2="100%" y2="18" stroke="#d4c89a" strokeWidth="0.8" />
        </svg>
      )}
    </div>
  );
}

/* ─── ZoomBtn ────────────────────────────────────────────── */
interface ZoomBtnProps {
  label: string;
  onClick: () => void;
  small?: boolean;
}
export function ZoomBtn({ label, onClick, small }: ZoomBtnProps) {
  return (
    <button className={`zoom-btn${small ? " small" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

/* ─── ITBtn (input toolbar icon button) ──────────────────── */
export function ITBtn({ icon }: { icon: React.ReactNode }) {
  return <button className="it-btn">{icon}</button>;
}

/* ─── ChatMsg ────────────────────────────────────────────── */
export function ChatMsg({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg ${isUser ? "user" : "ai"}`}>
      {msg.text && <div className="bubble">{msg.text}</div>}
      {msg.math && (
        <>
          <div className="bubble">Projection of v = (3,2) onto x-axis:</div>
          <div className="math-block">{msg.math.join("\n")}</div>
        </>
      )}
      {msg.extra && <div className="bubble" style={{ marginTop: 3 }}>{msg.extra}</div>}
      {msg.math2 && <div className="math-block">{msg.math2.join("\n")}</div>}
      <div className="msg-time">{msg.time}</div>
    </div>
  );
}

/* ─── ClearModal ─────────────────────────────────────────── */
interface ClearModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}
export function ClearModal({ onConfirm, onCancel }: ClearModalProps) {
  return (
    <div className="clear-overlay">
      <div className="clear-modal">
        <p>Clear the board?</p>
        <div className="clear-modal-actions">
          <button className="clear-confirm-btn" onClick={onConfirm}>Clear</button>
          <button className="clear-cancel-btn"  onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ─── NotebookLines (Echo panel background) ──────────────── */
export function NotebookLines() {
  return (
    <svg className="nb-lines-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="nbp" x="0" y="0" width="100%" height="24" patternUnits="userSpaceOnUse">
          <line x1="0" y1="23.5" x2="100%" y2="23.5" stroke="#e8ddb0" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nbp)" />
      <line x1="34" y1="0" x2="34" y2="100%" stroke="#f5c0b0" strokeWidth="1.1" opacity="0.6" />
    </svg>
  );
}

/* ─── DrawingLayer (the demo SVG content on the canvas) ──── */
export const DrawingLayer = React.forwardRef<SVGGElement>((_, ref) => (
  <svg className="drawing-svg" viewBox="0 0 560 458" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="aw" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="#e8f5e8"/></marker>
      <marker id="ab" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="#5bc8f5"/></marker>
      <marker id="ar" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3z" fill="#ff5c5c"/></marker>
    </defs>
    <g ref={ref}>
      <line x1="60" y1="60" x2="60" y2="260" stroke="#e8f5e8" strokeWidth="1.4" markerEnd="url(#aw)" opacity="0.7"/>
      <line x1="60" y1="260" x2="230" y2="260" stroke="#e8f5e8" strokeWidth="1.4" markerEnd="url(#aw)" opacity="0.7"/>
      <text x="234" y="264" fontSize="11" fill="rgba(232,245,232,0.45)" fontFamily="Georgia">x</text>
      <text x="52" y="57" fontSize="11" fill="rgba(232,245,232,0.45)" fontFamily="Georgia">y</text>
      <line x1="60" y1="260" x2="180" y2="148" stroke="#5bc8f5" strokeWidth="2.2" markerEnd="url(#ab)"/>
      <text x="125" y="196" fontSize="12" fill="#5bc8f5" fontFamily="Georgia" fontStyle="italic">v = (3,2)</text>
      <line x1="60" y1="260" x2="164" y2="210" stroke="#ff5c5c" strokeWidth="2.2" markerEnd="url(#ar)"/>
      <rect x="56" y="197" width="118" height="18" rx="3" fill="rgba(255,92,92,0.1)" stroke="#ff5c5c" strokeWidth="0.9"/>
      <text x="61" y="210" fontSize="10" fill="#ff5c5c" fontFamily="Georgia" fontStyle="italic">u = ? (proj x)</text>
      <text x="300" y="82" fontSize="13" fill="#f5c842" fontFamily="Georgia" fontStyle="italic">Matrix A:</text>
      <text x="310" y="108" fontSize="12" fill="#e8f5e8" fontFamily="Courier New">{"[ 2   -1 ]"}</text>
      <text x="310" y="127" fontSize="12" fill="#e8f5e8" fontFamily="Courier New">{"[ 0    3 ]"}</text>
      <text x="310" y="146" fontSize="12" fill="#e8f5e8" fontFamily="Courier New">{"[ 1    1 ]"}</text>
      <rect x="298" y="88" width="150" height="70" rx="4" fill="rgba(255,92,92,0.07)" stroke="#ff5c5c" strokeWidth="1.6" strokeDasharray="5,3"/>
      <text x="300" y="174" fontSize="10" fill="rgba(232,245,232,0.3)" fontFamily="Georgia" fontStyle="italic">find eigenvalues →</text>
      <text x="60" y="316" fontSize="12" fill="#a3e635" fontFamily="Georgia">F = ma</text>
      <text x="60" y="338" fontSize="11" fill="rgba(232,245,232,0.55)" fontFamily="Courier New">F = 5 × 2.4</text>
      <text x="60" y="356" fontSize="12" fill="#f5c842" fontFamily="Courier New">F = 12 N</text>
      <line x1="53" y1="300" x2="53" y2="362" stroke="rgba(163,230,53,0.3)" strokeWidth="1.4"/>
      <rect x="298" y="210" width="150" height="88" rx="4" fill="#f5c842" opacity="0.9"/>
      <text x="311" y="230" fontSize="11" fill="#2c2200" fontFamily="Georgia" fontWeight="bold">Reminder:</text>
      <line x1="308" y1="235" x2="440" y2="235" stroke="#c8a200" strokeWidth="0.7"/>
      <text x="310" y="250" fontSize="10" fill="#3a2e00" fontFamily="Georgia">eigen = char. poly</text>
      <text x="310" y="266" fontSize="10" fill="#3a2e00" fontFamily="Georgia">det(A − λI) = 0</text>
      <text x="310" y="282" fontSize="10" fill="#3a2e00" fontFamily="Georgia">solve for λ values</text>
      <rect x="60" y="372" width="160" height="14" rx="3" fill="rgba(255,230,50,0.4)"/>
      <text x="63" y="383" fontSize="10" fill="#7a6000" fontFamily="Georgia">highlighted formula area</text>
      <rect x="60" y="392" width="120" height="14" rx="3" fill="rgba(80,220,120,0.35)"/>
      <text x="63" y="403" fontSize="10" fill="#1a5a30" fontFamily="Georgia">key concept here</text>
    </g>
  </svg>
));
DrawingLayer.displayName = "DrawingLayer";

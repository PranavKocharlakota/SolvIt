import React, { useState, useRef, useEffect } from 'react';
import { Step, ChatMessage, DiagramType, RecognitionResult } from '../lib/types';
import StepCard from './StepCard';

interface SidebarProps {
  recognition: RecognitionResult | null;
  liveDescription: string | null;
  steps: Step[];
  loading: { recognize: boolean; solve: boolean; live: boolean };
  error: string | null;
  onChatSubmit: (msg: string) => void;
  chatMessages: ChatMessage[];
  onDrawStep: (diagram: DiagramType) => void;
  onFetchDiagram: (stepDescription: string) => Promise<DiagramType>;
}

export default function Sidebar({
  recognition, liveDescription, steps, loading, error, onChatSubmit, chatMessages, onDrawStep, onFetchDiagram,
}: SidebarProps) {
  const [input, setInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onChatSubmit(input.trim());
    setInput('');
  };

  const hasContent = recognition || liveDescription || loading.recognize || loading.solve || loading.live || steps.length > 0 || error;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 320, height: '100vh',
      background: '#0f172a', borderLeft: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column', zIndex: 20,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1e293b' }}>
        <h2 style={{ color: '#38bdf8', fontSize: 15, fontWeight: 700, margin: 0 }}>Math Whiteboard AI</h2>
        <p style={{ color: '#475569', fontSize: 11, margin: '3px 0 0' }}>Draw a problem → Recognize → Ask questions</p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>

        {/* Live interpretation — updates as you draw */}
        {(liveDescription || loading.live) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: loading.live ? '#f59e0b' : '#22c55e',
                boxShadow: `0 0 6px ${loading.live ? '#f59e0b' : '#22c55e'}`,
              }} />
              <span style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {loading.live ? 'Interpreting...' : 'Live'}
              </span>
            </div>
            {liveDescription && (
              <div style={{
                background: '#0f1f0f', border: '1px solid #166534', borderRadius: 8,
                padding: '8px 12px', color: '#86efac', fontSize: 12, lineHeight: 1.5,
                fontStyle: 'italic',
              }}>
                {liveDescription}
              </div>
            )}
          </div>
        )}

        {/* Loading states */}
        {loading.recognize && (
          <StatusBadge color="#38bdf8">Analyzing drawing...</StatusBadge>
        )}
        {loading.solve && (
          <StatusBadge color="#a78bfa">Generating solution...</StatusBadge>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8,
            padding: '10px 12px', color: '#fca5a5', fontSize: 12, marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {/* Recognition result */}
        {recognition && !loading.recognize && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Recognition</SectionLabel>

            {/* Content type badge */}
            {recognition.content_type && recognition.content_type !== 'unknown' && (
              <div style={{ marginBottom: 7 }}>
                <span style={{
                  background: '#1e3a5f', color: '#38bdf8', fontSize: 10,
                  borderRadius: 4, padding: '2px 8px', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{recognition.content_type}</span>
              </div>
            )}

            <div style={{
              background: '#1e293b', borderRadius: 8, padding: '10px 12px',
              borderLeft: '3px solid #38bdf8', marginBottom: 8,
            }}>
              <p style={{ color: '#e2e8f0', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                {recognition.description}
              </p>
            </div>

            {recognition.latex && (
              <div style={{
                background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 6,
                padding: '6px 10px', fontFamily: 'monospace', fontSize: 13,
                color: '#7dd3fc', marginBottom: 8,
              }}>
                {recognition.latex}
              </div>
            )}

            {recognition.elements.length > 0 && (
              <div>
                <div style={{ color: '#475569', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  Elements
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {recognition.elements.map((el, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{
                        background: '#1e293b', color: '#93c5fd', fontSize: 11,
                        borderRadius: 4, padding: '2px 7px', flexShrink: 0,
                      }}>{el.label}</span>
                      {el.detail && (
                        <span style={{ color: '#64748b', fontSize: 11 }}>{el.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Solution steps */}
        {steps.length > 0 && !loading.solve && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Solution</SectionLabel>
            {steps.map(step => (
              <StepCard
                key={step.stepNumber}
                step={step}
                onDrawStep={onDrawStep}
                onFetchDiagram={onFetchDiagram}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasContent && (
          <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 40, lineHeight: 1.8 }}>
            Draw a math or physics problem<br />on the canvas, then click<br />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>🔍 Recognize</span>
          </div>
        )}

        {/* Chat messages */}
        {chatMessages.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <SectionLabel>Chat</SectionLabel>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 8, display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: msg.role === 'user' ? '#1d4ed8' : '#1e293b',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  padding: '8px 12px', color: '#e2e8f0', fontSize: 12, lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* Chat input */}
      <form onSubmit={handleSubmit} style={{
        padding: 12, borderTop: '1px solid #1e293b', display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={recognition ? 'Ask a follow-up...' : 'Draw something first...'}
          disabled={!recognition && steps.length === 0}
          style={{
            flex: 1, background: '#1e293b', border: '1px solid #334155',
            borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none',
          }}
        />
        <button type="submit" disabled={!input.trim()} style={{
          background: '#3b82f6', color: '#fff', border: 'none',
          borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13,
        }}>➤</button>
      </form>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: '#475569', fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function StatusBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#1e293b', borderRadius: 8, padding: '8px 12px',
      marginBottom: 10, color, fontSize: 12,
    }}>
      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
      {children}
    </div>
  );
}

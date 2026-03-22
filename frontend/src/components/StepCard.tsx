import React, { useState } from 'react';
import { Step, DiagramType } from '../lib/types';

interface StepCardProps {
  step: Step;
  onDrawStep: (diagram: DiagramType) => void;
  onFetchDiagram: (stepDescription: string) => Promise<DiagramType>;
}

export default function StepCard({ step, onDrawStep, onFetchDiagram }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  const handleDraw = async () => {
    setLoading(true);
    setDrawError(null);
    try {
      // Always fetch a fresh diagram from the backend — never use step.diagram
      // directly since the solve API may return legacy types the renderer can't use.
      const diagram = await onFetchDiagram(step.explanation);
      if (diagram) {
        onDrawStep(diagram);
      } else {
        setDrawError('No diagram returned for this step.');
      }
    } catch (err: any) {
      setDrawError(err.message || 'Failed to generate diagram');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          color: '#e2e8f0',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <span style={{
          background: '#3b82f6',
          color: '#fff',
          borderRadius: '50%',
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          flexShrink: 0,
        }}>{step.stepNumber}</span>
        <span style={{ flex: 1, lineHeight: 1.4 }}>{step.explanation.slice(0, 80)}{step.explanation.length > 80 ? '…' : ''}</span>
        <span style={{ color: '#64748b', fontSize: 16 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{step.explanation}</p>
          {step.equation && (
            <div style={{
              background: '#0f172a',
              border: '1px solid #1e3a5f',
              borderRadius: 6,
              padding: '6px 10px',
              fontFamily: 'monospace',
              fontSize: 13,
              color: '#7dd3fc',
              marginBottom: 8,
            }}>
              {step.equation}
            </div>
          )}
          {(step.diagram || true) && (
            <button
              onClick={handleDraw}
              disabled={loading}
              style={{
                background: loading ? '#334155' : '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: loading ? 'default' : 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {loading ? 'Drawing...' : '🎨 Draw this step'}
            </button>
          )}
          {drawError && (
            <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 6 }}>{drawError}</div>
          )}
        </div>
      )}
    </div>
  );
}

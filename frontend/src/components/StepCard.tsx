import React, { useState } from 'react';
import { Step } from '../lib/types';

interface StepCardProps {
  step: Step;
}

export default function StepCard({ step }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);

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
            }}>
              {step.equation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

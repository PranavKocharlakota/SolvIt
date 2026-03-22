import { DiagramType, RecognitionResult, Step, StrokeContext, ApiStroke, StrokeDelta } from './types';

const BASE = '/api';

async function checkResponse(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function describeDrawing(imageBase64: string): Promise<string> {
  const res = await fetch(`${BASE}/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  const data = await checkResponse(res);
  return data.description ?? '';
}

export async function recognizeDrawing(
  imageBase64: string,
  strokes?: ApiStroke[],
  delta?: StrokeDelta,
): Promise<RecognitionResult> {
  const res = await fetch(`${BASE}/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, strokes, delta }),
  });
  return checkResponse(res);
}

export async function solveProblem(
  recognition: RecognitionResult,
  question?: string,
): Promise<{ steps: Step[] }> {
  const res = await fetch(`${BASE}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recognition, question }),
  });
  return checkResponse(res);
}

export async function drawStep(
  stepDescription: string,
  ctx?: StrokeContext,
  semanticScene?: RecognitionResult | null,
): Promise<DiagramType> {
  const res = await fetch(`${BASE}/draw-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stepDescription,
      ...(ctx && {
        styleFeatures: ctx.styleFeatures,
        strokeBounds: ctx.strokeBounds,
        strokeCount: ctx.strokeCount,
      }),
      ...(semanticScene && { semanticScene }),
    }),
  });
  return checkResponse(res);
}

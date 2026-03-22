import { RecognitionResult, Step, ApiStroke, StrokeDelta } from './types';

const BASE = '/api';

async function post(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach backend — is the server running on port 3002?');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = `HTTP ${res.status}`;
    try { detail = JSON.parse(text)?.detail || detail; } catch { /* not JSON */ }
    throw new Error(detail);
  }
  return res.json();
}

export async function describeDrawing(imageBase64: string): Promise<string> {
  const data = await post('/describe', { imageBase64 });
  return data.description ?? '';
}

export async function recognizeDrawing(
  imageBase64: string,
  strokes?: ApiStroke[],
  delta?: StrokeDelta,
): Promise<RecognitionResult> {
  return post('/recognize', { imageBase64, strokes, delta });
}

export async function solveProblem(
  recognition: RecognitionResult,
  question?: string,
): Promise<{ text?: string | null; steps?: Step[] | null }> {
  return post('/solve', { recognition, question });
}

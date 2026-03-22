import { useRef, useState, useCallback } from 'react';
import KonvaWhiteboard, { KonvaWhiteboardHandle } from './components/KonvaWhiteboard';
import Sidebar from './components/Sidebar';
import { describeDrawing, recognizeDrawing, solveProblem, drawStep as fetchDiagram } from './lib/api';
import { Step, ChatMessage, DiagramType, RecognitionResult } from './lib/types';
import './App.css';

export default function App() {
  const canvasRef = useRef<KonvaWhiteboardHandle>(null);
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [liveDescription, setLiveDescription] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState({ recognize: false, solve: false, live: false });
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const handleLiveUpdate = useCallback(async (imageBase64: string) => {
    setLoading(l => ({ ...l, live: true }));
    try {
      const description = await describeDrawing(imageBase64);
      setLiveDescription(description);
    } catch { /* silent — live updates are best-effort */ }
    finally { setLoading(l => ({ ...l, live: false })); }
  }, []);

  const handleRecognize = useCallback(async () => {
    if (!canvasRef.current) return;
    setError(null);
    setSteps([]);

    const imageBase64 = canvasRef.current.getImageBase64();
    const strokes = canvasRef.current.exportStrokesForAPI();
    const delta = canvasRef.current.getStrokeDelta();

    try {
      setLoading(l => ({ ...l, recognize: true }));
      const result = await recognizeDrawing(imageBase64, strokes, delta);
      setRecognition(result);
      canvasRef.current?.markRecognized();
      setLoading(l => ({ ...l, recognize: false }));

      setLoading(l => ({ ...l, solve: true }));
      const { steps: solvedSteps } = await solveProblem(result);
      setSteps(solvedSteps || []);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(l => ({ ...l, recognize: false, solve: false }));
    }
  }, []);

  const handleChatSubmit = useCallback(async (message: string) => {
    if (!recognition) return;
    setChatMessages(msgs => [...msgs, { role: 'user', content: message }]);
    setError(null);
    try {
      const { steps: newSteps } = await solveProblem(recognition, message);
      setSteps(newSteps || []);
      setChatMessages(msgs => [...msgs, {
        role: 'assistant',
        content: `Updated the solution with ${newSteps?.length ?? 0} steps.`,
      }]);
    } catch (err: any) {
      setError(err.message || 'Chat error');
    }
  }, [recognition]);

  const handleDrawStep = useCallback((diagram: DiagramType) => {
    canvasRef.current?.drawDiagram(diagram);
  }, []);

  const handleFetchDiagram = useCallback(async (stepDescription: string): Promise<DiagramType> => {
    const ctx = canvasRef.current?.getStrokeContext();
    return fetchDiagram(stepDescription, ctx, recognition);
  }, [recognition]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a1a2e' }}>
      <KonvaWhiteboard ref={canvasRef} onRecognize={handleRecognize} onLiveUpdate={handleLiveUpdate} />
      <Sidebar
        recognition={recognition}
        liveDescription={liveDescription}
        steps={steps}
        loading={loading}
        error={error}
        onChatSubmit={handleChatSubmit}
        chatMessages={chatMessages}
        onDrawStep={handleDrawStep}
        onFetchDiagram={handleFetchDiagram}
      />
    </div>
  );
}

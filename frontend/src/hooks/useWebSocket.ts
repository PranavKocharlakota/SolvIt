import { useRef, useCallback, useEffect, useState } from 'react';

type WSStatus = 'connecting' | 'open' | 'closed' | 'error';

interface WSHook {
  status: WSStatus;
  send: (type: string, payload: Record<string, unknown>) => void;
  lastMessage: { type: string; payload: unknown } | null;
}

export function useWebSocket(url: string): WSHook {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>('closed');
  const [lastMessage, setLastMessage] = useState<{ type: string; payload: unknown } | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    ws.current = socket;
    setStatus('connecting');

    socket.onopen = () => setStatus('open');
    socket.onclose = () => setStatus('closed');
    socket.onerror = () => setStatus('error');
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setLastMessage(msg);
      } catch { /* ignore */ }
    };

    // Heartbeat
    const ping = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', payload: {} }));
      }
    }, 30_000);

    return () => {
      clearInterval(ping);
      socket.close();
    };
  }, [url]);

  const send = useCallback((type: string, payload: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { status, send, lastMessage };
}

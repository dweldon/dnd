import { useEffect, useRef, useState } from 'react';
import type { View } from '../game/view';
import type { ClientMessage, ServerMessage } from '../messages';

const TOKEN_KEY = 'token';

// Live game state over a WebSocket; reconnects and rejoins with the saved token
export function useGame() {
  const [view, setView] = useState<View | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const token = localStorage.getItem(TOKEN_KEY) ?? '';
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(
        `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`,
      );
      socket.current = ws;
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage;
        if (msg.type === 'state') {
          setView(msg.view);
          setThinking(msg.thinking);
        } else if (msg.type === 'token') {
          localStorage.setItem(TOKEN_KEY, msg.token);
        } else {
          setError(msg.error);
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, []);

  const send = (msg: ClientMessage) => {
    setError(null);
    socket.current?.send(JSON.stringify(msg));
  };

  return { view, thinking, error, send };
}

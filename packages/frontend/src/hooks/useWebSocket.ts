import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '@finance-automation/shared';

type MessageHandler = (message: WSMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<MessageHandler>(onMessage);
  handlersRef.current = onMessage;

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = () => console.log('WebSocket connected');

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handlersRef.current(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 2s...');
        setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);
}

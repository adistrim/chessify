import { useEffect, useState } from "react";

const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8080";

export const useSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      setSocket(ws);
    };
    ws.onclose = () => {
      setSocket(null);
    };
    ws.onerror = () => {
      setSocket(null);
    };
    return () => {
      ws.close();
    };
  }, []);

  return socket;
};

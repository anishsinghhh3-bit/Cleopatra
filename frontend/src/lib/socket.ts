export type SocketStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface SocketHandlers {
  onMessage: (data: any) => void;
  onStatus?: (status: SocketStatus) => void;
  onFatalClose?: (code: number) => void;
}

export interface SocketOptions {
  /** Return false to stop auto-reconnecting after an unexpected drop. */
  shouldRetry?: () => boolean;
  retryDelayMs?: number;
  /** Injectable for tests; defaults to the browser WebSocket. */
  WebSocketImpl?: any;
}

export interface SocketController {
  send: (payload: unknown) => boolean;
  /** Drop the current connection and open a fresh one right now. */
  reconnect: () => void;
  close: () => void;
}

/**
 * A WebSocket that reconnects on its own after an unexpected drop (network
 * blip, phone backgrounded, server restart). Application close codes
 * (4000-4999, e.g. 4401 = bad token) are deliberate and never retried.
 * After close() is called it never reconnects.
 */
export function connectWithRetry(
  makeUrl: () => string,
  handlers: SocketHandlers,
  options: SocketOptions = {}
): SocketController {
  const WS = options.WebSocketImpl ?? WebSocket;
  const delay = options.retryDelayMs ?? 2000;
  let ws: any = null;
  let retryTimer: any = null;
  let stopped = false;

  function open(isRetry: boolean) {
    handlers.onStatus?.(isRetry ? "reconnecting" : "connecting");
    const socket = new WS(makeUrl());
    ws = socket;

    socket.onopen = () => {
      if (ws === socket) handlers.onStatus?.("open");
    };

    socket.onmessage = (event: { data: string }) => {
      if (ws !== socket) return;
      let parsed: any;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      handlers.onMessage(parsed);
    };

    socket.onclose = (event: { code: number }) => {
      if (stopped || ws !== socket) return;
      if (event.code >= 4000 && event.code <= 4999) {
        handlers.onStatus?.("closed");
        handlers.onFatalClose?.(event.code);
        return;
      }
      if (options.shouldRetry && !options.shouldRetry()) {
        handlers.onStatus?.("closed");
        return;
      }
      handlers.onStatus?.("reconnecting");
      retryTimer = setTimeout(() => open(true), delay);
    };
  }

  open(false);

  return {
    send(payload: unknown): boolean {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(payload));
        return true;
      }
      return false;
    },
    reconnect() {
      if (stopped) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const old = ws;
      ws = null; // the old socket's late events are now ignored
      if (old) {
        try {
          old.close();
        } catch {
          /* already closed */
        }
      }
      open(true);
    },
    close() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    },
  };
}

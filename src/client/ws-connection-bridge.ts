export type WsConnectionEvent = "open" | "closed-reconnecting";

type WsConnectionListener = (event: WsConnectionEvent) => void;

let listener: WsConnectionListener | null = null;

export function setWsConnectionListener(next: WsConnectionListener | null): void {
  listener = next;
}

export function notifyWsConnection(event: WsConnectionEvent): void {
  listener?.(event);
}

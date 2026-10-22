import { describe, expect, it, vi } from "vitest";
import {
  notifyWsConnection,
  setWsConnectionListener,
} from "./ws-connection-bridge.ts";

describe("ws-connection-bridge", () => {
  it("notifies listener on socket lifecycle events", () => {
    const listener = vi.fn();
    setWsConnectionListener(listener);
    notifyWsConnection("closed-reconnecting");
    notifyWsConnection("open");
    expect(listener).toHaveBeenCalledWith("closed-reconnecting");
    expect(listener).toHaveBeenCalledWith("open");
    setWsConnectionListener(null);
  });
});

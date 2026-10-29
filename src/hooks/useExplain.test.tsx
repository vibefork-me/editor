// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../client/protocol.generated.ts";
import type { AgentTransport, ExplainOutcome } from "../client/types.ts";
import { bindAgentTransport } from "../stores/agent-bridge.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { useExplain } from "./useExplain.ts";

/** A transport whose `explain` sends `messages`, then ends with `outcome`. */
function transport(messages: ServerMessage[], outcome: ExplainOutcome) {
  const explain = vi.fn(async (_params: Parameters<AgentTransport["explain"]>[0], onMessage: (m: ServerMessage) => void) => {
    for (const m of messages) onMessage(m);
    return outcome;
  });
  bindAgentTransport({ explain } as unknown as AgentTransport);
  return explain;
}

const canvas = (seq: number, ev: Extract<ServerMessage, { type: "canvas" }>["ev"]): ServerMessage => ({
  type: "canvas",
  project: "notes-app",
  session: "s1",
  seq,
  at: seq,
  ev,
});

describe("explain", () => {
  afterEach(() => bindAgentTransport(null));

  it("asks about a part in the person's language; the answer goes to the canvas, nothing stays here", async () => {
    const ingest = vi.spyOn(useCanvasStore.getState(), "ingest").mockImplementation(() => {});
    const explain = transport(
      [canvas(1, { type: "question", text: "What is it?", id: "p2" }), canvas(2, { type: "explained", text: "Notes.", id: "p2" })],
      { kind: "done" },
    );
    const { result } = renderHook(() => useExplain("notes-app", "de"));
    await act(() => result.current.explain("  What is it? ", "p2"));
    expect(explain).toHaveBeenCalledWith({ projectId: "notes-app", question: "What is it?", part: "p2", lang: "de" }, expect.any(Function));
    expect(ingest).toHaveBeenCalledTimes(2);
    expect(result.current.refused).toEqual([]);
    expect(result.current.explaining).toBe(false);
    ingest.mockRestore();
  });

  it("keeps a question the agent did not take, with why", async () => {
    transport([], { kind: "error", error: "busy", code: "task_already_running" });
    const { result } = renderHook(() => useExplain("notes-app", "en"));
    await act(() => result.current.explain("What is it?"));
    expect(result.current.refused).toEqual([
      expect.objectContaining({ text: "What is it?", kind: "explain", failed: true, reason: "messages.explainBusy" }),
    ]);
  });

  it("adds nothing when the connection drops after the agent took the question", async () => {
    const ingest = vi.spyOn(useCanvasStore.getState(), "ingest").mockImplementation(() => {});
    transport([canvas(1, { type: "question", text: "What is it?" })], { kind: "error", error: "connection to the agent closed" });
    const { result } = renderHook(() => useExplain("notes-app", "en"));
    await act(() => result.current.explain("What is it?"));
    expect(result.current.refused).toEqual([]);
    ingest.mockRestore();
  });
});

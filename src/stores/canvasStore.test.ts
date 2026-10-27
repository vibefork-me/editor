import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCanvasState } from "../canvas/canvasState.ts";
import { stream } from "../canvas/testSessions.ts";
import type { CanvasRecord, CanvasResponse } from "../client/protocol.generated.ts";
import type { AgentTransport } from "../client/types.ts";
import { bindAgentTransport } from "./agent-bridge.ts";
import { useCanvasStore } from "./canvasStore.ts";

/** An agent whose log holds `log`, read `page` records at a time. */
function agent(log: () => CanvasRecord[], page = 10) {
  const getCanvas = vi.fn(async ({ from }: { projectId: string; from: number }): Promise<CanvasResponse> => {
    const events = log().filter((r) => r.seq >= from).slice(0, page);
    return { events, next: events.length > 0 ? events[events.length - 1]!.seq + 1 : from };
  });
  bindAgentTransport({ getCanvas } as unknown as AgentTransport);
  return getCanvas;
}

const live = (r: CanvasRecord, project = "p") => ({ ...r, project });

describe("canvas store", () => {
  afterEach(() => {
    useCanvasStore.getState().reset();
    bindAgentTransport(null);
  });

  it("reads the whole stream page by page when a project opens", async () => {
    const getCanvas = agent(() => stream);
    await useCanvasStore.getState().open("p");
    const s = useCanvasStore.getState();
    expect(s.lastSeq).toBe(stream.length);
    expect(s.canvas).toEqual(buildCanvasState(stream));
    expect(getCanvas.mock.calls.length).toBeGreaterThan(1);
  });

  it("applies live events in order and ignores repeats and other projects", async () => {
    agent(() => []);
    await useCanvasStore.getState().open("p");
    const ingest = useCanvasStore.getState().ingest;
    ingest(live(stream[0]!));
    ingest(live(stream[0]!));
    ingest(live(stream[1]!, "other"));
    ingest(live(stream[1]!));
    expect(useCanvasStore.getState().records.map((r) => r.seq)).toEqual([1, 2]);
  });

  it("fills a gap from the agent before going on", async () => {
    let log = stream.slice(0, 2);
    const getCanvas = agent(() => log);
    await useCanvasStore.getState().open("p");
    log = stream.slice(0, 10);
    // The editor missed 3..9 (e.g. a reconnect) and gets 10 live.
    useCanvasStore.getState().ingest(live(stream[9]!));
    await vi.waitFor(() => expect(useCanvasStore.getState().lastSeq).toBe(10));
    expect(useCanvasStore.getState().canvas).toEqual(buildCanvasState(stream.slice(0, 10)));
    expect(getCanvas).toHaveBeenCalledWith({ projectId: "p", from: 3 });
  });

  it("keeps live events that arrive while the stream is read", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    bindAgentTransport({
      getCanvas: async ({ from }: { from: number }) => {
        await gate;
        const events = stream.slice(0, 5).filter((r) => r.seq >= from);
        return { events, next: from + events.length };
      },
    } as unknown as AgentTransport);
    const opening = useCanvasStore.getState().open("p");
    useCanvasStore.getState().ingest(live(stream[5]!));
    release();
    await opening;
    expect(useCanvasStore.getState().lastSeq).toBe(6);
  });
});

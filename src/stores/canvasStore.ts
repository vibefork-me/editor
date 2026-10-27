import { create } from "zustand";
import { applyCanvasEvent, initialCanvasState, type CanvasState } from "../canvas/canvasState.ts";
import type { CanvasRecord } from "../client/protocol.generated.ts";
import { getAgentTransport } from "./agent-bridge.ts";

/** A live `canvas` message of the agent. */
export interface CanvasMessage extends CanvasRecord {
  project: string;
}

export interface CanvasStoreState {
  projectId: string | null;
  /** The project's stream, in `seq` order without gaps. */
  records: CanvasRecord[];
  /** The canvas built from `records`. */
  canvas: CanvasState;
  /** `seq` of the newest record; 0 before the first. */
  lastSeq: number;
  /** The stream is being read from the agent (open or a gap). */
  catchingUp: boolean;
  error: string | null;
  /** Shows a project: reads its whole stream from the agent. */
  open: (projectId: string) => Promise<void>;
  /** Adds a live event; a gap in the numbering is filled from the agent first. */
  ingest: (message: CanvasMessage) => void;
  /** Reads what the agent added to the stream since (e.g. after it drew the map). */
  refresh: () => Promise<void>;
  reset: () => void;
}

const empty = {
  projectId: null as string | null,
  records: [] as CanvasRecord[],
  canvas: initialCanvasState,
  lastSeq: 0,
  catchingUp: false,
  error: null as string | null,
};

// Live events that arrive while the stream is being read; applied right after it.
let pending: CanvasRecord[] = [];

export const useCanvasStore = create<CanvasStoreState>((set, get) => {
  /** Appends the records that continue the stream, in order; others are left out. */
  function append(records: CanvasRecord[]) {
    const s = get();
    let { canvas, lastSeq } = s;
    const added: CanvasRecord[] = [];
    for (const r of [...records].sort((a, b) => a.seq - b.seq)) {
      if (r.seq !== lastSeq + 1) continue;
      canvas = applyCanvasEvent(canvas, r.ev, r.at);
      lastSeq = r.seq;
      added.push(r);
    }
    if (added.length > 0) set({ canvas, lastSeq, records: [...s.records, ...added] });
  }

  async function catchUp(projectId: string) {
    const transport = getAgentTransport();
    if (!transport || get().catchingUp) return;
    set({ catchingUp: true, error: null });
    try {
      for (;;) {
        const from = get().lastSeq + 1;
        const page = await transport.getCanvas({ projectId, from });
        if (get().projectId !== projectId) return;
        append(page.events);
        if (page.events.length === 0 || page.next <= from) break;
      }
    } catch (e) {
      if (get().projectId === projectId) set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      if (get().projectId === projectId) {
        set({ catchingUp: false });
        const waiting = pending;
        pending = [];
        append(waiting);
        // Something newer than the stream still missing: read again.
        if (waiting.some((r) => r.seq > get().lastSeq + 1)) void catchUp(projectId);
      }
    }
  }

  return {
    ...empty,
    async open(projectId) {
      pending = [];
      set({ ...empty, projectId });
      await catchUp(projectId);
    },
    ingest(message) {
      const { project, ...record } = message;
      const s = get();
      if (project !== s.projectId || record.seq <= s.lastSeq) return;
      if (s.catchingUp) {
        pending.push(record);
      } else if (record.seq === s.lastSeq + 1) {
        append([record]);
      } else {
        pending.push(record);
        void catchUp(project);
      }
    },
    async refresh() {
      const { projectId } = get();
      if (projectId) await catchUp(projectId);
    },
    reset() {
      pending = [];
      set({ ...empty });
    },
  };
});

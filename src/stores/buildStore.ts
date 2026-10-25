import { create } from "zustand";
import type { BuildMessage, BuildOutcome } from "../client/types.ts";
import { getAgentTransport } from "./agent-bridge.ts";
import { useProjectStore } from "./projectStore.ts";

export function buildLogLine(m: BuildMessage): string | null {
  switch (m.type) {
    case "estimate":
    case "build_log":
    case "stderr":
      return m.text;
    case "toolchain":
      return `${m.tool}: ${m.status}${m.error ? ` — ${m.error}` : ""}`;
    default:
      return null;
  }
}

export type BuildStatus = "idle" | "building" | "built" | "failed" | "cancelled";

export interface BuildState {
  status: BuildStatus;
  log: string[];
  outcome: BuildOutcome | null;
  error: string | null;
  isPanelOpen: boolean;
  copiedArtifacts: boolean;
  startBuild: (projectId: string) => Promise<BuildOutcome | null>;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  copyArtifactsPath: () => Promise<boolean>;
  resetBuild: () => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
  status: "idle",
  log: [],
  outcome: null,
  error: null,
  isPanelOpen: false,
  copiedArtifacts: false,

  setPanelOpen: (open: boolean) => set({ isPanelOpen: open }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  copyArtifactsPath: async () => {
    const outcome = get().outcome;
    if (outcome && outcome.kind === "done" && outcome.artifacts) {
      try {
        await navigator.clipboard.writeText(outcome.artifacts);
        set({ copiedArtifacts: true });
        setTimeout(() => {
          set({ copiedArtifacts: false });
        }, 2000);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },

  resetBuild: () =>
    set({
      status: "idle",
      log: [],
      outcome: null,
      error: null,
      isPanelOpen: false,
      copiedArtifacts: false,
    }),

  startBuild: async (projectId: string) => {
    const transport = getAgentTransport();
    if (!transport) {
      set({
        status: "failed",
        error: "No connection to agent",
        isPanelOpen: true,
      });
      return null;
    }

    set({
      status: "building",
      log: [],
      outcome: null,
      error: null,
      isPanelOpen: true,
      copiedArtifacts: false,
    });

    // Dismiss foreign code banner once the first build starts per requirement 1
    useProjectStore.getState().clearForeignChanges();

    try {
      const outcome = await transport.runBuild(projectId, (m) => {
        const line = buildLogLine(m);
        if (line) {
          set((s) => ({ log: [...s.log.slice(-499), line] }));
        }
      });

      if (outcome.kind === "done") {
        if (outcome.code === 0) {
          set({ status: "built", outcome, error: null });
        } else {
          set({
            status: "failed",
            outcome,
            error: `Build process exited with code ${outcome.code}`,
          });
        }
      } else if (outcome.kind === "error") {
        set({ status: "failed", outcome, error: outcome.error });
      } else if (outcome.kind === "cancelled") {
        set({ status: "cancelled", outcome, error: null });
      }
      return outcome;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: "failed", error: msg });
      return null;
    }
  },
}));

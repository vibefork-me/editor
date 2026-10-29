import { create } from "zustand";
import type { BuildMessage, BuildOutcome } from "../client/types.ts";
import { toolErrorKey } from "../client/agent-errors.ts";
import { translate, useI18nStore } from "../i18n/i18nStore.ts";
import { getAgentTransport } from "./agent-bridge.ts";

export function buildLogLine(m: BuildMessage): string | null {
  switch (m.type) {
    case "estimate":
    case "build_log":
    case "stderr":
      return m.text;
    case "toolchain": {
      // A known code is worded in the person's language; an unknown one keeps the agent's text.
      const key = toolErrorKey(m.code);
      if (key) return translate(useI18nStore.getState().locale, key, { tool: m.tool });
      return `${m.tool}: ${m.status}${m.error ? ` — ${m.error}` : ""}`;
    }
    default:
      return null;
  }
}

export type BuildStatus = "idle" | "building" | "built" | "failed" | "cancelled";
export type BuildErrorKind = "noConnection" | "processFailed" | "agentError" | "buildNotConfirmed" | "general";

export interface BuildState {
  activeProjectId: string | null;
  buildingProjectId: string | null;
  status: BuildStatus;
  log: string[];
  outcome: BuildOutcome | null;
  errorKey: BuildErrorKind | null;
  error: string | null;
  isPanelOpen: boolean;
  copiedArtifacts: boolean;
  setActiveProject: (projectId: string | null) => void;
  startBuild: (projectId: string) => Promise<BuildOutcome | null>;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  copyArtifactsPath: () => Promise<boolean>;
  resetBuild: () => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
  activeProjectId: null,
  buildingProjectId: null,
  status: "idle",
  log: [],
  outcome: null,
  errorKey: null,
  error: null,
  isPanelOpen: false,
  copiedArtifacts: false,

  setActiveProject: (projectId: string | null) => {
    set((s) => {
      if (s.activeProjectId === projectId) return s;
      const isSameAsBuilding = s.buildingProjectId !== null && s.buildingProjectId === projectId;
      return {
        activeProjectId: projectId,
        ...(isSameAsBuilding
          ? {}
          : {
              status: "idle",
              log: [],
              outcome: null,
              errorKey: null,
              error: null,
              isPanelOpen: false,
              copiedArtifacts: false,
            }),
      };
    });
  },

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
      buildingProjectId: null,
      status: "idle",
      log: [],
      outcome: null,
      errorKey: null,
      error: null,
      isPanelOpen: false,
      copiedArtifacts: false,
    }),

  startBuild: async (projectId: string) => {
    const transport = getAgentTransport();
    if (!transport) {
      set({
        activeProjectId: projectId,
        buildingProjectId: projectId,
        status: "failed",
        errorKey: "noConnection",
        error: null,
        isPanelOpen: true,
      });
      return null;
    }

    set({
      activeProjectId: projectId,
      buildingProjectId: projectId,
      status: "building",
      log: [],
      outcome: null,
      errorKey: null,
      error: null,
      isPanelOpen: true,
      copiedArtifacts: false,
    });

    try {
      const outcome = await transport.runBuild(projectId, (m) => {
        // Prevent cross-project build log leaks if active project switched
        if (get().activeProjectId !== projectId) {
          return;
        }
        const line = buildLogLine(m);
        if (line) {
          set((s) => ({ log: [...s.log.slice(-499), line] }));
        }
      });

      // Ignore outcome if user switched away to another project
      if (get().activeProjectId !== projectId) {
        return outcome;
      }

      if (outcome.kind === "done") {
        if (outcome.code === 0) {
          set({ status: "built", outcome, errorKey: null, error: null });
        } else {
          set({
            status: "failed",
            outcome,
            errorKey: "processFailed",
            error: null,
          });
        }
      } else if (outcome.kind === "error") {
        const errorKey =
          outcome.code === "build_not_confirmed" || outcome.error === "build not confirmed"
            ? "buildNotConfirmed"
            : "agentError";
        set({
          status: "failed",
          outcome,
          errorKey,
          error: outcome.error,
        });
      } else if (outcome.kind === "cancelled") {
        set({ status: "cancelled", outcome, errorKey: null, error: null });
      }
      return outcome;
    } catch (err) {
      if (get().activeProjectId !== projectId) {
        return null;
      }
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: "failed", errorKey: "general", error: msg });
      return null;
    }
  },
}));

import { create } from "zustand";
import type { GraphEdge, GraphNode, GraphResponse, GraphSnapshot, GraphSource } from "../client/types.ts";
import { getAgentTransport } from "./agent-bridge.ts";
import { translate, useI18nStore } from "../i18n/i18nStore.ts";
import type { GraphPhase } from "./types.ts";

export type GraphViewMode = "parts" | "folders";

/** Why the map shows folders although parts were asked for. */
export type MapNotice = { kind: "failed"; reason: string };

export const initialGraphState = {
  revision: 0 as number | string,
  nodes: new Map<string, GraphNode>(),
  edges: [] as GraphEdge[],
  focusNodeId: null as string | null,
  phase: "exploring" as GraphPhase,
  hasGraphCapability: false,
  currentProjectId: null as string | null,
  currentView: "parts" as GraphViewMode,
  source: null as GraphSource | null,
  isLoading: false,
  isDescribing: false,
  partsMap: null as GraphResponse | null,
  folderMap: null as GraphResponse | null,
  mapNotice: null as MapNotice | null,
};

export interface GraphState {
  revision: number | string;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  focusNodeId: string | null;
  phase: GraphPhase;
  hasGraphCapability: boolean;
  currentProjectId: string | null;
  currentView: GraphViewMode;
  source: GraphSource | null;
  isLoading: boolean;
  isDescribing: boolean;
  partsMap: GraphResponse | null;
  folderMap: GraphResponse | null;
  mapNotice: MapNotice | null;

  setPhase: (phase: GraphPhase) => void;
  loadGraph: (projectId: string, view?: GraphViewMode) => Promise<void>;
  refreshGraph: () => Promise<void>;
  setView: (view: GraphViewMode) => Promise<void>;
  /** Asks the model for the parts again after a failure. */
  retryParts: () => Promise<void>;
  applyResponse: (res: GraphResponse) => void;
  applySnapshot: (snapshot: GraphSnapshot) => void;
  setHasGraphCapability: (enabled: boolean) => void;
  resetGraph: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  ...initialGraphState,

  setPhase: (phase) => set({ phase }),

  applyResponse: (res) => {
    const nodes = new Map<string, GraphNode>();
    for (const n of res.nodes) {
      const label =
        n.id === "other" && !n.label
          ? translate(useI18nStore.getState().locale, "canvas.otherNodeLabel")
          : n.label;
      nodes.set(n.id, {
        id: n.id,
        label,
        files: n.files,
        changed: n.changed,
        status: n.changed > 0 ? "changed" : "unchanged",
        summary: n.summary ?? undefined,
      });
    }
    set({
      revision: res.revision ?? get().revision,
      source: res.source,
      nodes,
      edges: res.edges.map((e) => ({ from: e.from, to: e.to })),
    });
  },

  loadGraph: async (projectId: string, view?: GraphViewMode) => {
    const transport = getAgentTransport();
    if (!transport || typeof transport.getGraph !== "function") return;
    const isNewProject = projectId !== get().currentProjectId;
    const targetView = view ?? (isNewProject ? "parts" : get().currentView);
    if (isNewProject) {
      set({
        currentProjectId: projectId,
        partsMap: null,
        folderMap: null,
        source: null,
        revision: 0,
        nodes: new Map(),
        edges: [],
        isDescribing: false,
      });
    }
    set({ isLoading: true, currentProjectId: projectId, currentView: targetView });
    try {
      const res = await transport.getGraph({
        projectId,
        view: targetView === "folders" ? "folders" : undefined,
      });
      if (get().currentProjectId !== projectId || get().currentView !== targetView) {
        return;
      }
      if (res.source === "folders") {
        set({ folderMap: res });
        // If we are in "parts" view and source is "folders", auto-describe per VF-155
        if (targetView === "parts") {
          set({ isDescribing: true, mapNotice: null });
          const lang = useI18nStore.getState().locale;
          try {
            const modelRes = await transport.describeGraph({ projectId, lang });
            if (get().currentProjectId !== projectId) {
              return;
            }
            if (get().currentView !== "parts") {
              set({ partsMap: modelRes, isDescribing: false });
              return;
            }
            set({ partsMap: modelRes, isDescribing: false, isLoading: false });
            get().applyResponse(modelRes);
            return;
          } catch (err) {
            if (get().currentProjectId !== projectId) {
              return;
            }
            console.warn("Auto-describe failed, falling back to folders:", err);
            if (get().currentView === "parts") {
              // Folders are shown: the switch says so, and the notice says why.
              set({
                currentView: "folders",
                mapNotice: { kind: "failed", reason: err instanceof Error ? err.message : String(err) },
              });
              get().applyResponse(res);
            }
            set({ isDescribing: false, isLoading: false });
            return;
          }
        }
      } else {
        set({ partsMap: res });
      }
      get().applyResponse(res);
      set({ isLoading: false });
    } catch (err) {
      if (get().currentProjectId === projectId) {
        console.error("Failed to load graph:", err);
        set({ isLoading: false, isDescribing: false });
      }
    }
  },

  setView: async (view: GraphViewMode) => {
    if (get().currentView === view) return;
    const projectId = get().currentProjectId;
    set({ currentView: view, mapNotice: null });
    if (!projectId) return;

    if (view === "folders") {
      if (get().folderMap) {
        get().applyResponse(get().folderMap!);
      } else {
        await get().loadGraph(projectId, "folders");
      }
    } else {
      if (get().partsMap) {
        get().applyResponse(get().partsMap!);
      } else {
        await get().loadGraph(projectId, "parts");
      }
    }
  },

  retryParts: async () => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    set({ partsMap: null, mapNotice: null });
    await get().loadGraph(projectId, "parts");
  },

  refreshGraph: async () => {
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const transport = getAgentTransport();
    if (!transport || typeof transport.getGraph !== "function") return;
    const view = get().currentView;
    try {
      const res = await transport.getGraph({
        projectId,
        view: view === "folders" ? "folders" : undefined,
      });
      if (get().currentProjectId !== projectId || get().currentView !== view) {
        return;
      }
      if (view === "folders") {
        set({ folderMap: res, partsMap: null });
      } else if (res.source === "model") {
        set({ partsMap: res, folderMap: null });
      } else {
        set({ folderMap: res, partsMap: null });
      }
      get().applyResponse(res);
    } catch (err) {
      if (get().currentProjectId === projectId) {
        console.warn("Failed to refresh graph:", err);
      }
    }
  },

  applySnapshot: (snapshot) => {
    const currentRev = get().revision;
    if (
      typeof snapshot.revision === "number" &&
      typeof currentRev === "number" &&
      snapshot.revision <= currentRev
    ) {
      return;
    }
    const nodes = new Map<string, GraphNode>();
    for (const node of snapshot.nodes) {
      nodes.set(node.id, {
        id: node.id,
        label: node.label,
        files: node.files ?? 0,
        changed: node.changed ?? 0,
        status: node.status ?? ((node.changed ?? 0) > 0 ? "changed" : "unchanged"),
        summary: node.summary,
      });
    }
    set({
      revision: snapshot.revision,
      nodes,
      edges: [...snapshot.edges],
      focusNodeId: snapshot.focus ?? null,
      phase: (snapshot.phase as GraphPhase) ?? get().phase,
    });
  },

  setHasGraphCapability: (enabled) => set({ hasGraphCapability: enabled }),

  resetGraph: () =>
    set({
      ...initialGraphState,
      nodes: new Map(),
      edges: [],
      partsMap: null,
      folderMap: null,
      revision: 0,
      focusNodeId: null,
    }),
}));

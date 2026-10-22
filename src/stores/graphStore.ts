import { create } from "zustand";
import type { GraphEdge, GraphNode, GraphSnapshot } from "../client/types.ts";
import type { GraphPhase } from "./types.ts";

export const initialGraphState = {
  revision: 0,
  nodes: new Map<string, GraphNode>(),
  edges: [] as GraphEdge[],
  focusNodeId: null as string | null,
  phase: "exploring" as GraphPhase,
  researchCursor: null as string | null,
  hasGraphCapability: false,
};

export interface GraphState {
  revision: number;
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  focusNodeId: string | null;
  phase: GraphPhase;
  researchCursor: string | null;
  hasGraphCapability: boolean;
  applySnapshot: (snapshot: GraphSnapshot) => void;
  setResearchCursor: (cursor: string | null) => void;
  setHasGraphCapability: (enabled: boolean) => void;
  resetGraph: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  ...initialGraphState,
  applySnapshot: (snapshot) => {
    if (snapshot.revision <= get().revision) return;
    const nodes = new Map<string, GraphNode>();
    for (const node of snapshot.nodes) {
      nodes.set(node.id, node);
    }
    set({
      revision: snapshot.revision,
      nodes,
      edges: [...snapshot.edges],
      focusNodeId: snapshot.focus,
      phase: snapshot.phase as GraphPhase,
    });
  },
  setResearchCursor: (cursor) => set({ researchCursor: cursor }),
  setHasGraphCapability: (enabled) => set({ hasGraphCapability: enabled }),
  resetGraph: () => set({ ...initialGraphState, nodes: new Map() }),
}));

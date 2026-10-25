import { create } from "zustand";
import type { ForeignChanges, ProjectMetadata, ProjectSummary } from "../client/types.ts";
import { getAgentTransport } from "./agent-bridge.ts";
import { useBuildStore } from "./buildStore.ts";
import { useGraphStore } from "./graphStore.ts";
import { useTaskStore } from "./taskStore.ts";
import { useViewerStore } from "./viewerStore.ts";

export interface ProjectState {
  currentProjectId: string | null;
  projectMeta: ProjectMetadata | null;
  grantedProjects: ProjectSummary[];
  foreignChanges: ForeignChanges | null;
  isLoading: boolean;
  selectProject: (projectId: string, meta?: ProjectMetadata | null) => Promise<void>;
  loadGrantedProjects: () => Promise<void>;
  setForeignChanges: (foreign: ForeignChanges | null) => void;
  clearForeignChanges: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  projectMeta: null,
  grantedProjects: [],
  foreignChanges: null,
  isLoading: false,
  setForeignChanges: (foreign) => set({ foreignChanges: foreign }),
  clearForeignChanges: () => set({ foreignChanges: null }),
  selectProject: async (projectId, meta) => {
    useGraphStore.getState().resetGraph();
    useTaskStore.getState().resetTask();
    useViewerStore.getState().resetViewer();
    useBuildStore.getState().resetBuild();
    set({
      currentProjectId: projectId,
      projectMeta: meta ?? { projectId },
      isLoading: false,
    });
    await useGraphStore.getState().loadGraph(projectId);
  },
  loadGrantedProjects: async () => {
    const transport = getAgentTransport();
    if (!transport) {
      set({ grantedProjects: [] });
      return;
    }
    set({ isLoading: true });
    try {
      const projects = await transport.listProjects();
      set({ grantedProjects: projects, isLoading: false });
    } catch {
      set({ grantedProjects: [], isLoading: false });
    }
  },
}));

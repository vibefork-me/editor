import { create } from "zustand";
import type { ProjectMetadata, ProjectSummary } from "../client/types.ts";
import { getAgentTransport } from "./agent-bridge.ts";
import { useGraphStore } from "./graphStore.ts";
import { useTaskStore } from "./taskStore.ts";
import { useViewerStore } from "./viewerStore.ts";

export interface ProjectState {
  currentProjectId: string | null;
  projectMeta: ProjectMetadata | null;
  grantedProjects: ProjectSummary[];
  isLoading: boolean;
  selectProject: (projectId: string, meta?: ProjectMetadata | null) => Promise<void>;
  loadGrantedProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  projectMeta: null,
  grantedProjects: [],
  isLoading: false,
  selectProject: async (projectId, meta) => {
    useGraphStore.getState().resetGraph();
    useTaskStore.getState().resetTask();
    useViewerStore.getState().resetViewer();
    set({
      currentProjectId: projectId,
      projectMeta: meta ?? { projectId },
      isLoading: false,
    });
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

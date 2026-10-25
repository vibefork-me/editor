import { create } from "zustand";
import type { ForeignChanges, ProjectMetadata, ProjectSummary } from "../client/types.ts";
import { getAgentTransport } from "./agent-bridge.ts";
import { useBuildStore } from "./buildStore.ts";
import { useGraphStore } from "./graphStore.ts";
import { useTaskStore } from "./taskStore.ts";
import { useViewerStore } from "./viewerStore.ts";

export interface ForeignChangesEntry {
  project: string;
  foreign: ForeignChanges;
}

export interface ProjectState {
  currentProjectId: string | null;
  projectMeta: ProjectMetadata | null;
  grantedProjects: ProjectSummary[];
  foreignChanges: ForeignChangesEntry | null;
  isLoading: boolean;
  selectProject: (projectId: string, meta?: ProjectMetadata | null) => Promise<void>;
  loadGrantedProjects: () => Promise<void>;
  setForeignChanges: (
    projectOrEntry: string | ForeignChangesEntry | null,
    foreign?: ForeignChanges | null,
  ) => void;
  clearForeignChanges: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: null,
  projectMeta: null,
  grantedProjects: [],
  foreignChanges: null,
  isLoading: false,
  setForeignChanges: (projectOrEntry, foreign) => {
    if (typeof projectOrEntry === "string") {
      if (foreign) {
        set({ foreignChanges: { project: projectOrEntry, foreign } });
      } else {
        set({ foreignChanges: null });
      }
    } else {
      set({ foreignChanges: projectOrEntry ?? null });
    }
  },
  clearForeignChanges: () => set({ foreignChanges: null }),
  selectProject: async (projectId, meta) => {
    useGraphStore.getState().resetGraph();
    useTaskStore.getState().resetTask();
    useViewerStore.getState().resetViewer();
    useBuildStore.getState().setActiveProject(projectId);
    set((s) => ({
      currentProjectId: projectId,
      projectMeta: meta ?? { projectId },
      foreignChanges: s.foreignChanges?.project === projectId ? s.foreignChanges : null,
      isLoading: false,
    }));
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

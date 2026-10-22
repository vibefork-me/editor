import { create } from "zustand";
import { getAgentTransport } from "./agent-bridge.ts";
import type { ViewerMode } from "./types.ts";

async function currentProjectId(): Promise<string | null> {
  const { useProjectStore } = await import("./projectStore.ts");
  return useProjectStore.getState().currentProjectId;
}

export const initialViewerState = {
  isOpen: false,
  activePath: null as string | null,
  mode: "file" as ViewerMode,
  content: null as string | null,
  diffOriginal: null as string | null,
  diffModified: null as string | null,
  isLoading: false,
  error: null as string | null,
};

export interface ViewerState {
  isOpen: boolean;
  activePath: string | null;
  mode: ViewerMode;
  content: string | null;
  diffOriginal: string | null;
  diffModified: string | null;
  isLoading: boolean;
  error: string | null;
  openFile: (path: string) => Promise<void>;
  openDiff: (path: string) => Promise<void>;
  closeViewer: () => void;
  resetViewer: () => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  ...initialViewerState,
  openFile: async (path) => {
    const projectId = await currentProjectId();
    const transport = getAgentTransport();
    if (!projectId || !transport) {
      set({ error: "Cannot open file", isOpen: false, activePath: null });
      return;
    }
    set({
      isOpen: true,
      activePath: path,
      mode: "file",
      isLoading: true,
      error: null,
      diffOriginal: null,
      diffModified: null,
    });
    try {
      const { content } = await transport.readFile({ projectId, path });
      set({ content, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "read failed",
        isLoading: false,
        content: null,
      });
    }
  },
  openDiff: async (path) => {
    const projectId = await currentProjectId();
    const transport = getAgentTransport();
    if (!projectId || !transport) {
      set({ error: "Cannot open diff", isOpen: false, activePath: null });
      return;
    }
    set({
      isOpen: true,
      activePath: path,
      mode: "diff",
      isLoading: true,
      error: null,
      content: null,
    });
    try {
      const { original, modified } = await transport.readDiff({ projectId, path });
      set({ diffOriginal: original, diffModified: modified, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "diff failed",
        isLoading: false,
        diffOriginal: null,
        diffModified: null,
      });
    }
  },
  closeViewer: () =>
    set({
      isOpen: false,
      activePath: null,
      content: null,
      diffOriginal: null,
      diffModified: null,
      error: null,
      isLoading: false,
    }),
  resetViewer: () => set({ ...initialViewerState }),
}));

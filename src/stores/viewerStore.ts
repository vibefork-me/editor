import { create } from "zustand";
import { getAgentTransport } from "./agent-bridge.ts";
import type { ViewerMode } from "./types.ts";

async function currentProjectId(): Promise<string | null> {
  const { useProjectStore } = await import("./projectStore.ts");
  return useProjectStore.getState().currentProjectId;
}

/** A file open in the code panel. */
export interface ViewerTab {
  path: string;
  mode: ViewerMode;
}

export const initialViewerState = {
  isOpen: false,
  tabs: [] as ViewerTab[],
  onlyChanges: false,
  activePath: null as string | null,
  mode: "file" as ViewerMode,
  content: null as string | null,
  diffOriginal: null as string | null,
  diffModified: null as string | null,
  isLoading: false,
  error: null as string | null,
  isTooLarge: false,
  isBinary: false,
  isForbidden: false,
};

export interface ViewerState {
  isOpen: boolean;
  /** Open files, in the order they were opened. */
  tabs: ViewerTab[];
  /** A changed file shows only its changes instead of the whole file with marks. */
  onlyChanges: boolean;
  activePath: string | null;
  mode: ViewerMode;
  content: string | null;
  diffOriginal: string | null;
  diffModified: string | null;
  isLoading: boolean;
  error: string | null;
  isTooLarge: boolean;
  isBinary: boolean;
  isForbidden: boolean;
  openFile: (path: string) => Promise<void>;
  openDiff: (path: string) => Promise<void>;
  /** Closes one tab; the neighbour becomes active. */
  closeTab: (path: string) => void;
  setOnlyChanges: (onlyChanges: boolean) => void;
  closeViewer: () => void;
  resetViewer: () => void;
}

function withTab(tabs: ViewerTab[], tab: ViewerTab): ViewerTab[] {
  const i = tabs.findIndex((t) => t.path === tab.path);
  if (i < 0) return [...tabs, tab];
  return tabs.map((t, j) => (j === i ? tab : t));
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  ...initialViewerState,
  openFile: async (path) => {
    const projectId = await currentProjectId();
    const transport = getAgentTransport();
    if (!projectId || !transport) {
      set({ error: "Cannot open file", isOpen: false, activePath: null });
      return;
    }
    set((s) => ({
      tabs: withTab(s.tabs, { path, mode: "file" }),
      isOpen: true,
      activePath: path,
      mode: "file",
      isLoading: true,
      error: null,
      isTooLarge: false,
      isBinary: false,
      isForbidden: false,
      diffOriginal: null,
      diffModified: null,
    }));
    try {
      const res = await transport.readFile({ projectId, path });
      if (res.tooLarge) {
        set({ isTooLarge: true, isLoading: false, content: null });
      } else if (res.binary) {
        set({ isBinary: true, isLoading: false, content: null });
      } else {
        set({ content: res.content ?? "", isLoading: false });
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : "read failed";
      const isForbidden = status === 403 || msg.includes("not shown") || msg.includes("leads out");
      set({
        isForbidden,
        error: isForbidden ? null : msg,
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
    set((s) => ({
      tabs: withTab(s.tabs, { path, mode: "diff" }),
      isOpen: true,
      activePath: path,
      mode: "diff",
      isLoading: true,
      error: null,
      isTooLarge: false,
      isBinary: false,
      isForbidden: false,
      content: null,
    }));
    try {
      const res = await transport.readDiff({ projectId, path });
      if (res.tooLarge) {
        set({
          isTooLarge: true,
          isLoading: false,
          diffOriginal: null,
          diffModified: null,
        });
      } else if (res.binary) {
        set({
          isBinary: true,
          isLoading: false,
          diffOriginal: null,
          diffModified: null,
        });
      } else {
        set({
          diffOriginal: res.original ?? "",
          diffModified: res.modified ?? "",
          isLoading: false,
        });
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : "diff failed";
      const isForbidden = status === 403 || msg.includes("not shown") || msg.includes("leads out");
      set({
        isForbidden,
        error: isForbidden ? null : msg,
        isLoading: false,
        diffOriginal: null,
        diffModified: null,
      });
    }
  },
  closeTab: (path) => {
    const { tabs, activePath } = get();
    const i = tabs.findIndex((t) => t.path === path);
    if (i < 0) {
      if (path === activePath) get().closeViewer();
      return;
    }
    const rest = tabs.filter((t) => t.path !== path);
    if (path !== activePath) {
      set({ tabs: rest });
      return;
    }
    const next = rest[Math.min(i, rest.length - 1)];
    if (!next) {
      get().closeViewer();
      return;
    }
    set({ tabs: rest });
    void (next.mode === "diff" ? get().openDiff(next.path) : get().openFile(next.path));
  },
  setOnlyChanges: (onlyChanges) => set({ onlyChanges }),
  closeViewer: () =>
    set({
      tabs: [],
      isOpen: false,
      activePath: null,
      content: null,
      diffOriginal: null,
      diffModified: null,
      error: null,
      isLoading: false,
      isTooLarge: false,
      isBinary: false,
      isForbidden: false,
    }),
  resetViewer: () => set({ ...initialViewerState, tabs: [] }),
}));

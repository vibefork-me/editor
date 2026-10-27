import { create } from "zustand";

/** The panels at the edges of the project page. */
export type PanelId = "files" | "code" | "journal";

export interface PanelLayout {
  open: boolean;
  /** Width (files, code) or height (journal), CSS pixels. */
  size: number;
}

export const PANEL_LIMITS: Record<PanelId, { min: number; max: number; initial: number }> = {
  files: { min: 180, max: 520, initial: 260 },
  code: { min: 320, max: 1100, initial: 560 },
  journal: { min: 120, max: 600, initial: 240 },
};

/** Sections of the Journal. */
export type JournalTab = "agent" | "build" | "program";

export const LAYOUT_STORAGE_KEY = "vf_layout";

const PANELS: PanelId[] = ["files", "code", "journal"];

function clampSize(id: PanelId, size: number): number {
  const { min, max } = PANEL_LIMITS[id];
  return Math.round(Math.min(max, Math.max(min, size)));
}

function initialLayout(): Record<PanelId, PanelLayout> {
  const layout = {
    files: { open: false, size: PANEL_LIMITS.files.initial },
    code: { open: false, size: PANEL_LIMITS.code.initial },
    journal: { open: false, size: PANEL_LIMITS.journal.initial },
  };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LAYOUT_STORAGE_KEY) : null;
    const saved = raw ? (JSON.parse(raw) as Partial<Record<PanelId, Partial<PanelLayout>>>) : null;
    for (const id of PANELS) {
      const s = saved?.[id];
      if (!s) continue;
      if (typeof s.open === "boolean") layout[id].open = s.open;
      if (typeof s.size === "number" && Number.isFinite(s.size)) layout[id].size = clampSize(id, s.size);
    }
  } catch {
    // Storage blocked or a broken value: the default layout.
  }
  return layout;
}

function save(panels: Record<PanelId, PanelLayout>) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(panels));
  } catch {
    // The layout is not remembered when storage is blocked.
  }
}

export interface LayoutState {
  panels: Record<PanelId, PanelLayout>;
  journalTab: JournalTab;
  setJournalTab: (tab: JournalTab) => void;
  toggle: (id: PanelId) => void;
  setOpen: (id: PanelId, open: boolean) => void;
  setSize: (id: PanelId, size: number) => void;
  /** Back to the layout of a first visit. */
  reset: () => void;
}

/** Which panels are open and how big they are; remembered in the browser. */
export const useLayoutStore = create<LayoutState>((set, get) => {
  const update = (panels: Record<PanelId, PanelLayout>) => {
    set({ panels });
    save(panels);
  };
  return {
    panels: initialLayout(),
    journalTab: "agent",
    setJournalTab: (journalTab) => set({ journalTab }),
    toggle: (id) => get().setOpen(id, !get().panels[id].open),
    setOpen: (id, open) => {
      const panels = get().panels;
      if (panels[id].open !== open) update({ ...panels, [id]: { ...panels[id], open } });
    },
    setSize: (id, size) => {
      const panels = get().panels;
      const next = clampSize(id, size);
      if (panels[id].size !== next) update({ ...panels, [id]: { ...panels[id], size: next } });
    },
    reset: () =>
      update({
        files: { open: false, size: PANEL_LIMITS.files.initial },
        code: { open: false, size: PANEL_LIMITS.code.initial },
        journal: { open: false, size: PANEL_LIMITS.journal.initial },
      }),
  };
});

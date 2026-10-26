import { create } from "zustand";

/** The "connect the AI" panel opened by the person (status bar), on top of a working editor. */
export interface AiPanelState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useAiPanelStore = create<AiPanelState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

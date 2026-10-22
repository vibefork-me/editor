import { create } from "zustand";
import type { ChoiceGroupData } from "./types.ts";

export const initialTaskState = {
  activeTaskId: null as string | null,
  taskReplayCursor: null as number | null,
  isAwaitingInput: false,
  activeChoiceGroup: null as ChoiceGroupData | null,
  isGapDetected: false,
};

export interface TaskState {
  activeTaskId: string | null;
  taskReplayCursor: number | null;
  isAwaitingInput: boolean;
  activeChoiceGroup: ChoiceGroupData | null;
  isGapDetected: boolean;
  setActiveTask: (taskId: string | null) => void;
  setTaskReplayCursor: (cursor: number | null) => void;
  setAwaitingInput: (awaiting: boolean, choiceGroup?: ChoiceGroupData | null) => void;
  setGapDetected: (gap: boolean) => void;
  resetTask: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  ...initialTaskState,
  setActiveTask: (taskId) => set({ activeTaskId: taskId }),
  setTaskReplayCursor: (cursor) => set({ taskReplayCursor: cursor }),
  setAwaitingInput: (awaiting, choiceGroup = null) =>
    set({ isAwaitingInput: awaiting, activeChoiceGroup: choiceGroup }),
  setGapDetected: (gap) => set({ isGapDetected: gap }),
  resetTask: () => set({ ...initialTaskState }),
}));

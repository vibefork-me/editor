import type { GraphPhase } from "../../stores/types.ts";

export type PhaseStep = {
  id: GraphPhase;
  label: string;
};

export const PHASE_STEPS: PhaseStep[] = [
  { id: "exploring", label: "Исследование" },
  { id: "edit", label: "Правка" },
  { id: "build", label: "Сборка" },
  { id: "test", label: "Тесты" },
  { id: "check", label: "Проверки" },
  { id: "done", label: "Готово" },
];

export function phaseIndex(phase: GraphPhase): number {
  return PHASE_STEPS.findIndex((step) => step.id === phase);
}

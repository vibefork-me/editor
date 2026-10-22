import { useGraphStore } from "../../stores/graphStore.ts";
import { IconCheck, IconTriangleAlert } from "./icons.tsx";
import { PHASE_STEPS, phaseIndex } from "./phases.ts";

function graphHasProblem(nodes: Map<string, { status: string }>): boolean {
  for (const node of nodes.values()) {
    if (node.status === "problem") return true;
  }
  return false;
}

export function PhaseRail() {
  const phase = useGraphStore((s) => s.phase);
  const nodes = useGraphStore((s) => s.nodes);
  const currentIdx = phaseIndex(phase);
  const hasProblem = graphHasProblem(nodes);

  return (
    <nav
      aria-label="Task phases"
      className="flex shrink-0 items-center border-b border-border bg-surface-elevated px-3 py-2 font-sans text-sm"
    >
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1" role="list">
        {PHASE_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isTodo = idx > currentIdx;
          const showProblem = isCurrent && hasProblem;

          return (
            <li
              key={step.id}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              className={`flex items-center gap-1.5 ${
                isDone
                  ? "text-phase-done"
                  : isCurrent
                    ? "text-phase-current"
                    : isTodo
                      ? "text-phase-todo"
                      : ""
              }`}
            >
              {isDone ? (
                <IconCheck className="size-4 shrink-0" />
              ) : showProblem ? (
                <IconTriangleAlert className="size-4 shrink-0 text-status-problem" />
              ) : isCurrent ? (
                <span
                  className="inline-block size-2 shrink-0 rounded-full bg-phase-current animate-phase-current"
                  aria-hidden="true"
                />
              ) : (
                <span className="inline-block size-2 shrink-0 rounded-full bg-phase-todo/40" aria-hidden="true" />
              )}
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

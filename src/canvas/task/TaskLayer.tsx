import { useEffect, useState } from "react";
import type { Artifact } from "../../client/protocol.generated.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { CanvasState } from "../canvasState.ts";
import { ArtifactWindow, HistoryPanel, ResultScreen, TaskPanel } from "./TaskViews.tsx";

/**
 * The task over the canvas: its panel bottom left while it runs, the "Done" screen at its end, the history
 * of changes, and a window for what a task produced.
 */
export function TaskLayer({ state }: { state: CanvasState }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Artifact | null>(null);
  const [history, setHistory] = useState(false);
  // The "Done" screen of a result goes once closed; a new result shows it again.
  const resultAt = state.history[state.history.length - 1]?.at ?? null;
  const [closedAt, setClosedAt] = useState<number | null>(null);
  useEffect(() => setOpen(null), [resultAt]);
  const label = (id: string) => state.nodes[id]?.label ?? id;

  return (
    <>
      <div className="absolute bottom-6 left-6 z-10">
        <TaskPanel state={state} />
      </div>
      {state.result && resultAt !== closedAt && !open && !history && (
        // Above the message field at the bottom of the canvas.
        <div className="absolute inset-x-0 bottom-40 z-10 flex justify-center">
          <ResultScreen state={state} onOpen={setOpen} onClose={() => setClosedAt(resultAt)} />
        </div>
      )}
      {state.history.length > 0 && (
        <button
          type="button"
          onClick={() => setHistory((h) => !h)}
          aria-pressed={history}
          className="absolute left-4 top-4 z-10 rounded-full border border-[#30363d] bg-[rgba(20,22,29,0.92)] px-3 py-1 text-xs text-[#c9d1d9] hover:border-[#58a6ff]"
        >
          {t("taskView.history")}
        </button>
      )}
      {history && (
        <div className="absolute bottom-4 left-4 top-14 z-20">
          <HistoryPanel state={state} onOpen={setOpen} onClose={() => setHistory(false)} />
        </div>
      )}
      {open && (
        <div className="absolute bottom-4 right-4 top-20 z-20">
          <ArtifactWindow artifact={open} label={label} onClose={() => setOpen(null)} />
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import type { Artifact } from "../../client/protocol.generated.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { CanvasState } from "../canvasState.ts";
import { ArtifactWindow, HistoryPanel, ResultScreen, TaskPanel, type HistoryVersions } from "./TaskViews.tsx";

/**
 * The task over the canvas: its panel bottom left while it runs, the "Done" screen at its end, the history
 * of changes, and a window for what a task produced.
 */
export function TaskLayer({
  state,
  history: shownHistory,
  onHistoryChange,
  versions,
}: {
  state: CanvasState;
  /** Versions of the project to return to, in the history. */
  versions?: HistoryVersions;
  /** With `onHistoryChange` the history is opened from outside (the project menu), without its own button. */
  history?: boolean;
  onHistoryChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Artifact | null>(null);
  const [ownHistory, setOwnHistory] = useState(false);
  const controlled = onHistoryChange !== undefined;
  const history = controlled ? (shownHistory ?? false) : ownHistory;
  const setHistory = (next: boolean) => (controlled ? onHistoryChange(next) : setOwnHistory(next));
  // The "Done" screen of a result goes once closed; a new result shows it again.
  const resultAt = state.history[state.history.length - 1]?.at ?? null;
  const [closedAt, setClosedAt] = useState<number | null>(null);
  useEffect(() => setOpen(null), [resultAt]);
  const label = (id: string) => state.nodes[id]?.label ?? id;

  return (
    <>
      {/* On a narrow screen the message field takes the bottom: the task goes under the stage rail. */}
      <div className="absolute bottom-6 left-6 z-10 max-sm:inset-x-3 max-sm:bottom-auto max-sm:top-36">
        <TaskPanel state={state} />
      </div>
      {state.result && resultAt !== closedAt && !open && !history && (
        // The moment the person came for: in the middle, the map behind it dimmed; the message field stays above.
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 animate-[fade-in_1s_ease-out_1.2s_both] bg-[radial-gradient(ellipse_at_center,rgba(20,22,29,0.35)_0%,rgba(20,22,29,0.8)_70%)]"
          />
          <div className="pointer-events-none absolute inset-x-3 bottom-40 top-24 z-10 flex items-center justify-center">
            <div className="pointer-events-auto max-h-full max-w-full overflow-y-auto">
              <ResultScreen state={state} onOpen={setOpen} onClose={() => setClosedAt(resultAt)} />
            </div>
          </div>
        </>
      )}
      {!controlled && state.history.length > 0 && (
        <button
          type="button"
          onClick={() => setHistory(!history)}
          aria-pressed={history}
          className="absolute left-4 top-4 z-10 rounded-full border border-[#30363d] bg-[rgba(20,22,29,0.92)] px-3 py-1 text-xs text-[#c9d1d9] hover:border-[#58a6ff]"
        >
          {t("taskView.history")}
        </button>
      )}
      {history && (
        <div className="absolute bottom-4 left-4 top-14 z-20">
          <HistoryPanel state={state} versions={versions} onOpen={setOpen} onClose={() => setHistory(false)} />
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

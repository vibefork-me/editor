import type { Artifact, ArtifactKind } from "../../client/protocol.generated.ts";
import { IconCheck, IconTriangleAlert } from "../../components/shell/icons.tsx";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import type { CanvasState } from "../canvasState.ts";
import { checkText, resultDetail, resultText } from "../outcomeText.ts";
import { TASK_STAGES } from "../rail/StageRail.tsx";

const KIND_TITLE: Record<ArtifactKind, TranslationKey> = {
  changes: "taskView.artifactChanges",
  report: "taskView.artifactReport",
  build: "taskView.artifactBuild",
  backup: "taskView.artifactBackup",
  log: "taskView.artifactLog",
};

const panel = "rounded-xl border border-[#262b36] bg-[rgba(20,22,29,0.94)] backdrop-blur shadow-2xl";
const caption = "text-[11px] font-semibold uppercase tracking-wide text-[#8b93a7]";
const closeButton =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#30363d] bg-[#1b1f28] text-[#8b93a7]";

/** Bottom left while a task runs: the task, its plan with what is done, the messages it took in, the checks. */
export function TaskPanel({ state }: { state: CanvasState }) {
  const { t } = useTranslation();
  if (!state.task || state.result || (state.stage && !TASK_STAGES.includes(state.stage))) return null;
  const finishing = state.stage === "check" || state.stage === "done";
  return (
    <section aria-label={t("taskView.task")} data-testid="task-panel" className={`${panel} flex max-h-[42vh] w-80 flex-col gap-2 overflow-y-auto p-3.5`}>
      <div className={caption}>{t("taskView.task")}</div>
      <div className="text-[13.5px] text-[#f4f5f8]">{state.task.text}</div>
      {state.plan.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {state.plan.map((text, i) => {
            const done = i < state.step || finishing;
            const active = i === state.step && state.stage === "change";
            return (
              <li key={i} className={`flex items-center gap-2 text-[12.5px] ${done ? "text-[#8fd19e]" : active ? "text-[#f4f5f8]" : "text-[#6e7681]"}`}>
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    done ? "border-[#2ea043] bg-[#238636] text-white" : active ? "border-[#58a6ff] bg-[#388bfd] text-white" : "border-[#30363d]"
                  }`}
                >
                  {done ? <IconCheck className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {text}
              </li>
            );
          })}
        </ol>
      )}
      {state.notesTaken.map((n) => (
        <div key={n.noteId} className="text-xs text-[#f778ba]">
          ↳ {t("taskView.asked", { text: n.reply })}
        </div>
      ))}
      {state.checks.map((c, i) => (
        <div key={i} className={`flex items-center gap-1.5 text-[12.5px] ${c.ok ? "text-[#8fd19e]" : "text-[#e3b341]"}`}>
          {c.ok ? <IconCheck className="h-3 w-3" /> : <IconTriangleAlert className="h-3 w-3" />}
          {checkText(t, c)}
        </div>
      ))}
    </section>
  );
}

/** The end of a task: what came out, and what it produced. */
export function ResultScreen({ state, onOpen, onClose }: { state: CanvasState; onOpen: (a: Artifact) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const result = state.result;
  if (!result) return null;
  const detail = resultDetail(t, result, (id) => state.nodes[id]?.label);
  return (
    <section aria-label={t("taskView.doneTitle")} data-testid="result-screen" className={`${panel} flex w-[380px] flex-col gap-3 p-4`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#238636] text-white">
          <IconCheck className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-[#f4f5f8]">{resultText(t, result)}</h2>
          {detail && <p className="mt-0.5 text-[12.5px] text-[#c9d1d9]">{detail}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={t("taskView.close")} className={closeButton}>
          ×
        </button>
      </div>
      {result.artifacts.length > 0 && (
        <ul className="flex flex-col gap-1">
          {result.artifacts.map((a, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onOpen(a)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#30363d] bg-[#1b1f28] px-2.5 py-1.5 text-left text-[12.5px] text-[#e6edf3] hover:border-[#58a6ff]"
              >
                <span>{t(KIND_TITLE[a.kind])}</span>
                <span className="truncate text-[#8b93a7]">{a.size ?? a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One thing a task produced, in a window on the right; `label` names a part by its id. */
export function ArtifactWindow({ artifact, label, onClose }: { artifact: Artifact; label: (id: string) => string; onClose: () => void }) {
  const { t } = useTranslation();
  const files = artifact.files ?? [];
  const checks = artifact.checks ?? [];
  const lines = artifact.lines ?? [];
  const empty = files.length === 0 && checks.length === 0 && lines.length === 0 && !artifact.path;
  return (
    <aside aria-label={t(KIND_TITLE[artifact.kind])} data-testid="artifact-window" className={`${panel} flex max-h-full w-[420px] flex-col gap-3 overflow-y-auto p-4`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-[#f4f5f8]">{t(KIND_TITLE[artifact.kind])}</h2>
          {artifact.about && <p className="text-[12.5px] text-[#c9d1d9]">{artifact.about}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={t("taskView.close")} className={closeButton}>
          ×
        </button>
      </div>
      {artifact.path && <p className="text-[12.5px] text-[#c9d1d9]">{t("taskView.where", { path: artifact.path })}</p>}
      {artifact.size && <p className="text-[12.5px] text-[#c9d1d9]">{t("taskView.size", { size: artifact.size })}</p>}
      {files.map((f) => (
        <section key={f.path} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-xs text-[#79c0ff]">{f.path}</span>
            {f.node && <span className="shrink-0 rounded-full border border-[#f2cc6066] px-2 text-[10.5px] text-[#f2cc60]">{label(f.node)}</span>}
          </div>
          {f.note && <p className="text-xs text-[#c9d1d9]">{f.note}</p>}
          {(f.diff ?? []).length > 0 && (
            <pre className="overflow-x-auto rounded-md bg-[#0d1117] p-2 font-mono text-[11.5px] leading-snug">
              {(f.diff ?? []).map((line, i) => (
                <div key={i} className={line.startsWith("+") ? "text-[#7ee787]" : line.startsWith("-") ? "text-[#ff7b72]" : "text-[#c9d1d9]"}>
                  {line}
                </div>
              ))}
            </pre>
          )}
        </section>
      ))}
      {checks.map((c, i) => (
        <div key={i} className={`flex items-center gap-1.5 text-[12.5px] ${c.ok ? "text-[#8fd19e]" : "text-[#ff7b72]"}`}>
          {c.ok ? <IconCheck className="h-3 w-3" /> : <IconTriangleAlert className="h-3 w-3" />}
          {c.text}
          {c.node && <span className="text-[#8b93a7]">· {label(c.node)}</span>}
        </div>
      ))}
      {lines.length > 0 && (
        <pre className="overflow-x-auto rounded-md bg-[#0d1117] p-2 font-mono text-[11.5px] leading-snug text-[#c9d1d9]">{lines.join("\n")}</pre>
      )}
      {empty && <p className="text-[12.5px] text-[#6e7681]">{t("taskView.noLines")}</p>}
    </aside>
  );
}

/** The project's finished tasks: the latest in green, earlier ones grey, each with what it produced. */
export function HistoryPanel({ state, onOpen, onClose }: { state: CanvasState; onOpen: (a: Artifact) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const items = [...state.history].reverse();
  return (
    <aside aria-label={t("taskView.history")} data-testid="history-panel" className={`${panel} flex max-h-full w-[360px] flex-col gap-2 overflow-y-auto p-4`}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-bold text-[#f4f5f8]">{t("taskView.history")}</h2>
        <button type="button" onClick={onClose} aria-label={t("taskView.close")} className={closeButton}>
          ×
        </button>
      </div>
      {items.length === 0 && <p className="text-[12.5px] text-[#6e7681]">{t("taskView.historyEmpty")}</p>}
      {items.map((h, i) => (
        <article
          key={`${h.at}-${i}`}
          className={`flex flex-col gap-1 rounded-lg border p-2.5 text-[12.5px] ${
            i === 0 ? "border-[#2ea04399] bg-[rgba(35,134,54,0.12)] text-[#e6edf3]" : "border-[#30363d] bg-[#161b22] text-[#8b93a7]"
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{h.task}</span>
            {i === 0 && <span className="text-[10.5px] text-[#8fd19e]">{t("taskView.current")}</span>}
          </div>
          <span>{h.outcome ? resultText(t, h.outcome) : h.result}</span>
          {h.changed.length > 0 && <span className="text-[#f2cc60]">{t("taskView.changed", { parts: h.changed.join(", ") })}</span>}
          <div className="flex flex-wrap gap-1">
            {h.artifacts.map((a, j) => (
              <button
                key={j}
                type="button"
                onClick={() => onOpen(a)}
                className="rounded-full border border-[#30363d] px-2 py-0.5 text-[11.5px] text-[#c9d1d9] hover:border-[#58a6ff]"
              >
                {t(KIND_TITLE[a.kind])}
              </button>
            ))}
          </div>
        </article>
      ))}
    </aside>
  );
}

import type { Artifact, ArtifactKind } from "../../client/protocol.generated.ts";
import { IconCheck, IconTriangleAlert } from "../../components/shell/icons.tsx";
import type { ProjectVersion, RollbackStatus } from "../../hooks/useRollback.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import { runProgramInJournal, useProgramStore } from "../../stores/programStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
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
    <section aria-label={t("taskView.task")} data-testid="task-panel" className={`${panel} flex max-h-[42vh] w-80 flex-col max-sm:max-h-[28vh] max-sm:w-auto gap-2 overflow-y-auto p-3.5`}>
      <div className={caption}>{t("taskView.task")}</div>
      <div className="text-[14px] font-semibold text-[#e2c5ff]">{state.task.text}</div>
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
  const projectId = useProjectStore((s) => s.currentProjectId);
  const programLive = useProgramStore((s) => s.status === "starting" || s.status === "running");
  const result = state.result;
  if (!result) return null;
  const detail = resultDetail(t, result, (id) => state.nodes[id]?.label);
  return (
    <section
      aria-label={t("taskView.doneTitle")}
      data-testid="result-screen"
      className="relative flex w-[520px] max-w-full animate-slide-up flex-col gap-3 rounded-2xl border border-[rgba(46,160,67,0.55)] bg-[rgba(22,27,34,0.97)] px-6 py-[22px] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(46,160,67,0.15)] max-sm:px-4 max-sm:py-4"
    >
      <button type="button" onClick={onClose} aria-label={t("taskView.close")} className={`${closeButton} absolute right-2.5 top-2.5 h-7 w-7 rounded-lg`}>
        ×
      </button>
      <div className="flex items-center gap-3 pr-9">
        <IconPackage />
        <h2 className="text-[20px] font-bold leading-tight text-[#f4f5f8] max-sm:text-[17px]">{resultText(t, result)}</h2>
      </div>
      {detail && <p className="text-[14px] leading-normal text-[#c9d1d9]">{detail}</p>}
      {state.changed.length > 0 && (
        <p className="text-[12.5px] leading-[1.45] text-[#8b93a7]" data-testid="result-changed">
          {t("taskView.changed", { parts: state.changed.map((id) => state.nodes[id]?.label ?? id).join(", ") })}
        </p>
      )}
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
      {projectId && result.artifacts.some((a) => a.kind === "build") && (
        <button
          type="button"
          data-testid="result-run"
          disabled={programLive}
          title={t("program.confirmNote")}
          onClick={() => void runProgramInJournal(projectId)}
          className="mt-1.5 flex items-center gap-1.5 self-start rounded-[9px] border border-[#2ea043] bg-[#238636] px-3.5 py-[9px] text-[13.5px] font-semibold text-white hover:bg-[#2ea043] disabled:opacity-60"
        >
          <IconPlay />
          {programLive ? t("program.running") : t("program.run")}
        </button>
      )}
    </section>
  );
}

function IconPackage() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M16 16l2 2 4-4" />
      <path d="M21 10V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l2-1.1" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3l14 9-14 9z" />
    </svg>
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

/** Versions of the project from its journal the person can return to; absent while a task runs. */
export interface HistoryVersions {
  items: ProjectVersion[];
  /** The version being returned to, or the last try. */
  restoring: { commit: string; status: RollbackStatus } | null;
  /** Another rollback is under way: the buttons wait. */
  disabled?: boolean;
  onRestore: (commit: string) => void;
}

function VersionList({ versions }: { versions: HistoryVersions }) {
  const { t, locale } = useTranslation();
  const when = (at: string) => {
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? at : d.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
  };
  const waiting = versions.restoring?.status.state === "confirm";
  return (
    <section aria-label={t("taskView.versions")} className="flex flex-col gap-1.5">
      <div className={`${caption} mt-1`}>{t("taskView.versions")}</div>
      {versions.items.map((v) => {
        const status = versions.restoring?.commit === v.commit ? versions.restoring.status : null;
        return (
          <article key={v.commit} className="flex flex-col gap-1 rounded-lg border border-[#30363d] bg-[#161b22] p-2.5 text-[12.5px] text-[#c9d1d9]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 break-words">{v.rollback ? t("taskView.partRolledBack") : v.title}</span>
              <span className="shrink-0 text-[10.5px] text-[#8b93a7]">{v.current ? t("taskView.current") : when(v.at)}</span>
            </div>
            {!v.current && (
              <button
                type="button"
                disabled={waiting || versions.disabled}
                onClick={() => versions.onRestore(v.commit)}
                className="self-start rounded-full border border-[#30363d] px-2.5 py-0.5 text-[11.5px] text-[#e6edf3] hover:border-[#58a6ff] disabled:cursor-wait disabled:opacity-60"
              >
                {t("taskView.restore")}
              </button>
            )}
            {status && (
              <p role="status" className={`text-xs ${status.state === "failed" ? "text-[#e3b341]" : status.state === "done" ? "text-[#8fd19e]" : "text-[#79c0ff]"}`}>
                {status.state === "confirm" ? t("card.undoConfirm") : status.state === "done" ? t("taskView.restoreDone") : t(status.reason)}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

/** The project's finished tasks: the latest in green, earlier ones grey, each with what it produced; then
 * the versions of the project to return to. */
export function HistoryPanel({
  state,
  versions,
  onOpen,
  onClose,
}: {
  state: CanvasState;
  versions?: HistoryVersions;
  onOpen: (a: Artifact) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const items = [...state.history].reverse();
  const hasVersions = (versions?.items.length ?? 0) > 0;
  return (
    <aside aria-label={t("taskView.history")} data-testid="history-panel" className={`${panel} flex max-h-full w-[360px] flex-col gap-2 overflow-y-auto p-4`}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-bold text-[#f4f5f8]">{t("taskView.history")}</h2>
        <button type="button" onClick={onClose} aria-label={t("taskView.close")} className={closeButton}>
          ×
        </button>
      </div>
      {items.length === 0 && !hasVersions && <p className="text-[12.5px] text-[#6e7681]">{t("taskView.historyEmpty")}</p>}
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
      {versions && hasVersions && <VersionList versions={versions} />}
    </aside>
  );
}

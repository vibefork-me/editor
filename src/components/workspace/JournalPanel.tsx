import { useEffect, useRef } from "react";
import type { CanvasState } from "../../canvas/canvasState.ts";
import { checkText } from "../../canvas/outcomeText.ts";
import { agentErrorKey } from "../../client/agent-errors.ts";
import type { FeedLine } from "../../client/task-feed.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { useLayoutStore, type JournalTab } from "../../stores/layoutStore.ts";
import { useProgramStore, type ProgramErrorKind } from "../../stores/programStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { FeedLineView } from "../chat/FeedLineView.tsx";
import { IconCheck, IconTriangleAlert } from "../shell/icons.tsx";
import { IconClose } from "./icons.tsx";

const TABS: [JournalTab, TranslationKey][] = [
  ["agent", "journal.agent"],
  ["build", "journal.build"],
  ["program", "journal.program"],
];

/** Which sections of the Journal have an error to look at. */
export function journalErrors(feed: FeedLine[], buildFailed: boolean, state: CanvasState, programFailed = false): Record<JournalTab, boolean> {
  const last = feed[feed.length - 1];
  return {
    agent: last?.kind === "error",
    build: buildFailed || (state.result === null && state.failed.length > 0),
    program: programFailed,
  };
}

/** Keeps the end of a growing list in view. */
function useStickToEnd(count: number) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof end.current?.scrollIntoView === "function") end.current.scrollIntoView({ block: "end" });
  }, [count]);
  return end;
}

function AgentSection({ feed, status }: { feed: FeedLine[]; status: string | null }) {
  const { t } = useTranslation();
  const end = useStickToEnd(feed.length);
  if (feed.length === 0 && !status) return <p className="text-text-muted">{t("journal.agentEmpty")}</p>;
  return (
    <div className="space-y-1.5" aria-live="polite" data-testid="task-feed">
      {feed.map((line, i) => (
        <FeedLineView key={i} line={line} />
      ))}
      {status && <p className="text-xs text-text-muted">{status}</p>}
      <div ref={end} />
    </div>
  );
}

function BuildSection({ state }: { state: CanvasState }) {
  const { t } = useTranslation();
  const projectId = useProjectStore((s) => s.currentProjectId);
  const status = useBuildStore((s) => s.status);
  const log = useBuildStore((s) => s.log);
  const outcome = useBuildStore((s) => s.outcome);
  const errorKey = useBuildStore((s) => s.errorKey);
  const errorCodeKey = useBuildStore((s) => (s.outcome?.kind === "error" ? agentErrorKey(s.outcome.code) : undefined));
  const error = useBuildStore((s) => s.error);
  const copied = useBuildStore((s) => s.copiedArtifacts);
  const startBuild = useBuildStore((s) => s.startBuild);
  const copyArtifactsPath = useBuildStore((s) => s.copyArtifactsPath);
  const end = useStickToEnd(log.length);
  const artifactsPath = outcome && outcome.kind === "done" ? outcome.artifacts : null;

  return (
    <div className="space-y-2" data-testid="build-section">
      <div className="flex flex-wrap items-center gap-2 font-sans">
        <button
          type="button"
          data-testid="build-button"
          disabled={!projectId || status === "building"}
          title={t("build.confirmNote")}
          onClick={() => projectId && void startBuild(projectId)}
          className="rounded border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
        >
          {status === "building" ? t("build.building") : status === "idle" ? t("build.action") : t("build.rebuild")}
        </button>
        {status === "built" && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <IconCheck className="size-3.5" />
            {t("build.succeeded")}
          </span>
        )}
        {status === "cancelled" && <span className="text-xs text-text-muted">{t("build.cancelled")}</span>}
        {artifactsPath && (
          <>
            <span className="max-w-full truncate rounded border border-border bg-surface px-2 py-0.5 font-mono text-[11px] text-text select-all" title={artifactsPath}>
              {artifactsPath}
            </span>
            <button type="button" onClick={() => void copyArtifactsPath()} className="rounded border border-accent/30 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/25">
              {copied ? t("common.copied") : t("build.copyPath")}
            </button>
          </>
        )}
      </div>
      {status === "idle" && log.length === 0 && state.checks.length === 0 && <p className="text-text-muted">{t("journal.buildEmpty")}</p>}
      {log.length > 0 && (
        <div data-testid="build-log" className="space-y-0.5 font-mono text-xs text-text-muted select-text">
          {log.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap break-all leading-tight">
              {line}
            </p>
          ))}
        </div>
      )}
      {status === "failed" && (
        <div role="alert" className="flex items-center gap-2 rounded border border-danger/30 bg-danger/10 p-2 font-sans text-xs text-danger">
          <IconTriangleAlert className="size-4 shrink-0" />
          <span>
            {errorKey === "noConnection"
              ? t("build.errorNoConnection")
              : errorKey === "processFailed"
                ? t("build.errorProcessFailed")
                : errorKey === "buildNotConfirmed"
                  ? t("build.errorNotConfirmed")
                  : errorCodeKey
                    ? t(errorCodeKey)
                    : (error ?? t("build.errorGeneral"))}
          </span>
        </div>
      )}
      {state.checks.length > 0 && (
        <div className="font-sans">
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("journal.checks")}</h4>
          <ul className="space-y-0.5 text-xs">
            {state.checks.map((c, i) => (
              <li key={i} className={`flex items-center gap-1.5 ${c.ok ? "text-success" : "text-danger"}`}>
                {c.ok ? <IconCheck className="size-3.5 shrink-0" /> : <IconTriangleAlert className="size-3.5 shrink-0" />}
                <span className="text-text">{checkText(t, c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

const PROGRAM_ERRORS: Record<ProgramErrorKind, TranslationKey> = {
  noConnection: "build.errorNoConnection",
  notConfirmed: "program.errorNotConfirmed",
  noRecipe: "program.errorNoRecipe",
  notSupported: "program.errorNotSupported",
  agentError: "program.errorGeneral",
};

function ProgramSection() {
  const { t } = useTranslation();
  const projectId = useProjectStore((s) => s.currentProjectId);
  const status = useProgramStore((s) => s.status);
  const lines = useProgramStore((s) => s.lines);
  const code = useProgramStore((s) => s.code);
  const cut = useProgramStore((s) => s.cut);
  const errorKey = useProgramStore((s) => s.errorKey);
  const error = useProgramStore((s) => s.error);
  const stop = useProgramStore((s) => s.stop);
  const start = useProgramStore((s) => s.start);
  const end = useStickToEnd(lines.length);
  const live = status === "starting" || status === "running";

  return (
    <div className="space-y-2" data-testid="program-section">
      <div className="flex flex-wrap items-center gap-2 font-sans">
        {live ? (
          <button
            type="button"
            data-testid="program-stop"
            disabled={!stop}
            onClick={() => stop?.()}
            className="rounded border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text hover:border-danger hover:text-danger disabled:opacity-60"
          >
            {t("program.stop")}
          </button>
        ) : (
          <button
            type="button"
            data-testid="program-run"
            disabled={!projectId}
            title={t("program.confirmNote")}
            onClick={() => projectId && void start(projectId)}
            className="rounded border border-border bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {status === "idle" ? t("program.run") : t("program.runAgain")}
          </button>
        )}
        {live && <span className="text-xs text-text-muted">{t("program.running")}</span>}
        {status === "exited" && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${code === 0 ? "text-success" : "text-danger"}`} data-testid="program-exit">
            {code === 0 ? <IconCheck className="size-3.5" /> : <IconTriangleAlert className="size-3.5" />}
            {t("program.exited", { code: String(code ?? -1) })}
          </span>
        )}
        {status === "cancelled" && <span className="text-xs text-text-muted">{t("program.stopped")}</span>}
      </div>
      {status === "idle" && <p className="text-text-muted">{t("journal.programEmpty")}</p>}
      {lines.length > 0 && (
        <div data-testid="program-log" className="space-y-0.5 font-mono text-xs select-text">
          {lines.map((line, i) => (
            <p key={i} className={`whitespace-pre-wrap break-all leading-tight ${line.stream === "stderr" ? "text-danger" : "text-text-muted"}`}>
              {line.text}
            </p>
          ))}
        </div>
      )}
      {cut && <p className="text-[11px] text-text-muted">{t("program.cut")}</p>}
      {status === "failed" && (
        <div role="alert" className="flex items-center gap-2 rounded border border-danger/30 bg-danger/10 p-2 font-sans text-xs text-danger">
          <IconTriangleAlert className="size-4 shrink-0" />
          <span>{errorKey === "agentError" && error ? error : t(PROGRAM_ERRORS[errorKey ?? "agentError"])}</span>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export interface JournalPanelProps {
  feed: FeedLine[];
  /** How the last task went, in a phrase; null before the first. */
  taskStatus: string | null;
  state: CanvasState;
  errors: Record<JournalTab, boolean>;
}

/** "Journal": what the agent does, the build and checks, the program; sections in the header. */
export function JournalPanel({ feed, taskStatus, state, errors }: JournalPanelProps) {
  const { t } = useTranslation();
  const tab = useLayoutStore((s) => s.journalTab);
  const setTab = useLayoutStore((s) => s.setJournalTab);
  const setOpen = useLayoutStore((s) => s.setOpen);
  const name = t("workspace.journalPanel");

  return (
    <section aria-label={name} className="flex min-h-0 flex-1 flex-col bg-surface font-sans" data-testid="journal-panel">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface-elevated px-2">
        <span className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{name}</span>
        <div role="tablist" aria-label={t("journal.tabs")} className="flex items-center gap-0.5">
          {TABS.map(([id, key]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-muted hover:text-text aria-selected:bg-surface aria-selected:text-text"
            >
              {t(key)}
              {errors[id] && <span className="size-1.5 rounded-full bg-danger" title={t("journal.error")} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={t("workspace.closePanel", { name })}
          onClick={() => setOpen("journal", false)}
          className="ml-auto flex size-6 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text"
        >
          <IconClose className="size-3.5" />
        </button>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3 text-sm">
        {tab === "agent" && <AgentSection feed={feed} status={taskStatus} />}
        {tab === "build" && <BuildSection state={state} />}
        {tab === "program" && <ProgramSection />}
      </div>
    </section>
  );
}

import { useEffect, useRef } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { IconCheck, IconTriangleAlert } from "./icons.tsx";

export function BuildPanel() {
  const { t } = useTranslation();
  const status = useBuildStore((s) => s.status);
  const log = useBuildStore((s) => s.log);
  const outcome = useBuildStore((s) => s.outcome);
  const errorKey = useBuildStore((s) => s.errorKey);
  const error = useBuildStore((s) => s.error);
  const isPanelOpen = useBuildStore((s) => s.isPanelOpen);
  const copiedArtifacts = useBuildStore((s) => s.copiedArtifacts);
  const togglePanel = useBuildStore((s) => s.togglePanel);
  const setPanelOpen = useBuildStore((s) => s.setPanelOpen);
  const copyArtifactsPath = useBuildStore((s) => s.copyArtifactsPath);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of log as new lines arrive
  useEffect(() => {
    if (
      isPanelOpen &&
      logEndRef.current &&
      typeof logEndRef.current.scrollIntoView === "function"
    ) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [log.length, isPanelOpen]);

  if (status === "idle" && log.length === 0) {
    return null;
  }

  const artifactsPath = outcome && outcome.kind === "done" ? outcome.artifacts : null;

  return (
    <aside
      role="region"
      aria-label={t("build.logTitle")}
      data-testid="build-panel"
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t border-border bg-surface-elevated/95 shadow-2xl backdrop-blur transition-all duration-300"
    >
      {/* Header bar */}
      <div className="flex h-10 items-center justify-between px-3 border-b border-border/70 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {status === "building" ? (
            <span className="flex items-center gap-1.5 text-accent font-semibold">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              <span>{t("build.building")}</span>
            </span>
          ) : status === "built" ? (
            <span className="flex items-center gap-1.5 text-success font-semibold">
              <IconCheck className="size-3.5 text-success" />
              <span>{t("build.succeeded")}</span>
            </span>
          ) : status === "failed" ? (
            <span className="flex items-center gap-1.5 text-danger font-semibold">
              <IconTriangleAlert className="size-3.5 text-danger" />
              <span>{t("build.failed")}</span>
            </span>
          ) : (
            <span className="text-text-muted font-medium">{t("build.cancelled")}</span>
          )}

          {/* Artifacts path summary and copy button */}
          {artifactsPath && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline text-text-muted">{t("build.artifactsPath")}</span>
              <span
                className="truncate font-mono text-[11px] bg-surface px-2 py-0.5 rounded border border-border text-text max-w-xs md:max-w-md select-all"
                title={artifactsPath}
              >
                {artifactsPath}
              </span>
              <button
                type="button"
                onClick={() => void copyArtifactsPath()}
                className="shrink-0 rounded bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-colors border border-accent/30"
              >
                {copiedArtifacts ? t("common.copied") : t("build.copyPath")}
              </button>
            </div>
          )}
        </div>

        {/* Panel controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={isPanelOpen}
            className="flex items-center gap-1 rounded px-2 py-1 text-text-muted hover:bg-surface hover:text-text transition-colors"
          >
            <span>{isPanelOpen ? t("build.hideLog") : t("build.showLog")}</span>
            <span className="font-mono text-[10px] text-text-muted">({log.length})</span>
            <svg
              className={`size-3.5 transition-transform duration-200 ${isPanelOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t("build.hideLog")}
            onClick={() => setPanelOpen(false)}
            className="rounded p-1 text-text-muted hover:bg-surface hover:text-text transition-colors"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log body */}
      {isPanelOpen && (
        <div
          data-testid="build-log"
          className="max-h-56 min-h-24 overflow-y-auto bg-surface/90 p-3 font-mono text-xs text-text-muted space-y-0.5 select-text border-b border-border/50"
        >
          {log.length === 0 ? (
            <p className="italic text-text-muted">{t("build.building")}</p>
          ) : (
            log.map((line, idx) => (
              <p key={idx} className="whitespace-pre-wrap break-all leading-tight">
                {line}
              </p>
            ))
          )}
          <div ref={logEndRef} />

          {/* Human-readable error message */}
          {status === "failed" && (
            <div
              role="alert"
              className="mt-2 rounded bg-danger/10 border border-danger/30 p-2 text-danger font-sans text-xs flex items-center gap-2"
            >
              <IconTriangleAlert className="size-4 shrink-0 text-danger" />
              <span>
                {errorKey === "noConnection"
                  ? t("build.errorNoConnection")
                  : errorKey === "processFailed"
                    ? t("build.errorProcessFailed")
                    : errorKey === "buildNotConfirmed"
                      ? t("build.errorNotConfirmed")
                      : error ?? t("build.errorGeneral")}
              </span>
            </div>
          )}

          {/* Success message banner inside log */}
          {status === "built" && (
            <div
              role="status"
              className="mt-2 rounded bg-success/10 border border-success/30 p-2 text-success font-sans text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconCheck className="size-4 text-success shrink-0" />
                <span>
                  {t("build.succeeded")}
                  {artifactsPath ? `: ${artifactsPath}` : ` — ${t("build.noArtifacts")}`}
                </span>
              </div>
              {artifactsPath && (
                <button
                  type="button"
                  onClick={() => void copyArtifactsPath()}
                  className="rounded bg-success/20 px-2 py-0.5 text-xs font-semibold text-success hover:bg-success/30 transition-colors"
                >
                  {copiedArtifacts ? t("common.copied") : t("build.copyPath")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

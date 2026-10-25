import { isGithubSaveEnabled } from "../../flags.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { useBuildStore, type BuildStatus } from "../../stores/buildStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";

export interface DoneSummaryProps {
  onSave?: () => void;
  isSaving?: boolean;
  onViewChanges?: () => void;
  saveMessage?: string | null;
  saveHref?: string | null;
  /** Explicit override for GitHub save visibility; defaults to isGithubSaveEnabled() */
  showGithubSave?: boolean;
  onBuild?: () => void;
  buildStatus?: BuildStatus;
  artifactsPath?: string | null;
  onCopyArtifacts?: () => void;
  copiedArtifacts?: boolean;
}

export function DoneSummary({
  onSave,
  isSaving = false,
  onViewChanges,
  saveMessage,
  saveHref,
  showGithubSave,
  onBuild,
  buildStatus: propBuildStatus,
  artifactsPath: propArtifactsPath,
  onCopyArtifacts,
  copiedArtifacts: propCopiedArtifacts,
}: DoneSummaryProps) {
  const { t } = useTranslation();
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const storeBuildStatus = useBuildStore((s) => s.status);
  const storeOutcome = useBuildStore((s) => s.outcome);
  const storeError = useBuildStore((s) => s.error);
  const storeCopied = useBuildStore((s) => s.copiedArtifacts);
  const startBuild = useBuildStore((s) => s.startBuild);
  const copyArtifactsPath = useBuildStore((s) => s.copyArtifactsPath);

  const shouldShowGithubSave = showGithubSave ?? isGithubSaveEnabled();

  const status = propBuildStatus ?? storeBuildStatus;
  const artifacts =
    propArtifactsPath ??
    (storeOutcome && storeOutcome.kind === "done" ? storeOutcome.artifacts : null);
  const isCopied = propCopiedArtifacts ?? storeCopied;

  const handleBuild = () => {
    if (onBuild) {
      onBuild();
    } else if (currentProjectId) {
      void startBuild(currentProjectId);
    }
  };

  const handleCopy = () => {
    if (onCopyArtifacts) {
      onCopyArtifacts();
    } else {
      void copyArtifactsPath();
    }
  };

  return (
    <div
      role="region"
      aria-label={t("canvas.doneSummaryTitle")}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(34rem,calc(100vw-3rem))] rounded-xl border border-success/50 bg-surface-elevated/95 p-4 text-text shadow-2xl backdrop-blur animate-slide-up max-h-[45%]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/20 text-success border border-success/40">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text">
            {t("canvas.doneSummaryTitle")}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted leading-relaxed">
            {t("canvas.doneSummarySubtitle")}
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            {/* MVP primary action: Build */}
            {!shouldShowGithubSave && (
              <button
                type="button"
                data-testid="done-build-button"
                disabled={status === "building"}
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  status === "built"
                    ? "bg-surface border border-border text-text hover:bg-surface-elevated"
                    : "bg-success text-black hover:bg-success/90"
                }`}
                onClick={handleBuild}
              >
                {status === "building"
                  ? t("build.building")
                  : status === "built"
                    ? t("build.rebuild")
                    : t("build.action")}
              </button>
            )}

            {/* Preserved GitHub Save code (hidden in MVP by default via flag) */}
            {shouldShowGithubSave && (
              <button
                type="button"
                disabled={!onSave || isSaving}
                className="rounded-md bg-success px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-success/90 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onSave}
              >
                {isSaving ? t("canvas.savingAction") : t("canvas.saveAction")}
              </button>
            )}

            {onViewChanges && (
              <button
                type="button"
                className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text hover:bg-border/60 transition-colors"
                onClick={onViewChanges}
              >
                {t("canvas.viewChangesAction")}
              </button>
            )}
          </div>

          {/* Build outcome summary when built in MVP mode */}
          {!shouldShowGithubSave && status === "built" && (
            <div className="mt-3 rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs text-text">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-success flex items-center gap-1">
                  <span>✓</span> {t("build.succeeded")}
                </span>
                {artifacts && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded bg-success/20 px-2 py-0.5 text-[11px] font-semibold text-success hover:bg-success/30 transition-colors"
                  >
                    {isCopied ? t("common.copied") : t("build.copyPath")}
                  </button>
                )}
              </div>
              {artifacts && (
                <p className="mt-1 font-mono text-[11px] text-text-muted truncate select-all" title={artifacts}>
                  {artifacts}
                </p>
              )}
            </div>
          )}

          {/* Build error summary if build failed */}
          {!shouldShowGithubSave && status === "failed" && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {storeError ?? t("build.failed")}
            </p>
          )}

          {/* GitHub Save message when flag enabled */}
          {shouldShowGithubSave && saveMessage && (
            <p role="status" className="mt-2 text-xs text-text-muted">
              {saveMessage}
              {saveHref && (
                <a
                  href={saveHref}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-accent underline underline-offset-2"
                >
                  {t("canvas.saveFollowup")}
                </a>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

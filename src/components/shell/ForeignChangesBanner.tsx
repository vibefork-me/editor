import type { ForeignChanges } from "../../client/types.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { IconTriangleAlert } from "./icons.tsx";

export interface ForeignChangesBannerProps {
  foreign: ForeignChanges;
  onDismiss?: () => void;
  onBuild?: () => void;
}

export function ForeignChangesBanner({
  foreign,
  onDismiss,
  onBuild,
}: ForeignChangesBannerProps) {
  const { t } = useTranslation();

  return (
    <aside
      role="region"
      aria-label={t("open.notOriginal")}
      data-testid="foreign-summary"
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[min(38rem,calc(100vw-3rem))] rounded-xl border border-amber-600/60 bg-surface-elevated/95 p-3.5 text-xs text-text shadow-xl backdrop-blur animate-slide-up"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
          <IconTriangleAlert className="size-4 shrink-0" />
          <span>{t("open.notOriginal")}</span>
        </div>
        {onDismiss && (
          <button
            type="button"
            aria-label={t("build.dismissBanner")}
            onClick={onDismiss}
            className="rounded p-1 text-text-muted hover:bg-surface hover:text-text transition-colors"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-2 space-y-1.5 text-text-muted">
        <p className="text-text font-medium">
          {t("open.changedFiles")} <span className="font-mono text-amber-300 font-semibold">{foreign.files}</span>
        </p>

        {(
          [
            ["open.changesDependencies", foreign.dependencies],
            ["open.changesBuildScripts", foreign.buildScripts],
            ["open.changesBinaries", foreign.binaries],
          ] as const
        ).map(([key, list]) =>
          list && list.length > 0 ? (
            <p key={key} className="break-all text-amber-300/90">
              {t(key)} <span className="font-mono text-amber-200">{list.join(", ")}</span>
            </p>
          ) : null
        )}

        {!foreign.complete && (
          <p className="text-amber-400 font-medium">
            {t("open.incompleteCheck")}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-amber-700/40 pt-2.5">
        <a
          href={foreign.compareUrl}
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-2 hover:brightness-110"
        >
          {t("open.viewChanges")}
        </a>

        {onBuild && (
          <button
            type="button"
            onClick={onBuild}
            className="rounded-md bg-accent px-3 py-1 font-semibold text-surface hover:brightness-110 transition-all shadow-sm"
          >
            {t("build.action")}
          </button>
        )}
      </div>
    </aside>
  );
}

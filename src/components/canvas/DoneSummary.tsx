import { useTranslation } from "../../i18n/i18nStore.ts";

export interface DoneSummaryProps {
  onSave?: () => void;
  isSaving?: boolean;
  onViewChanges?: () => void;
  saveMessage?: string | null;
  saveHref?: string | null;
}

export function DoneSummary({ onSave, isSaving = false, onViewChanges, saveMessage, saveHref }: DoneSummaryProps) {
  const { t } = useTranslation();

  return (
    <div
      role="region"
      aria-label={t("canvas.doneSummaryTitle")}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(32rem,calc(100vw-3rem))] rounded-xl border border-success/50 bg-surface-elevated/95 p-4 text-text shadow-2xl backdrop-blur animate-slide-up max-h-[40%]"
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

          <div className="mt-3.5 flex items-center gap-2.5">
            <button
              type="button"
              disabled={!onSave || isSaving}
              className="rounded-md bg-success px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-success/90 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSave}
            >
              {isSaving ? t("canvas.savingAction") : t("canvas.saveAction")}
            </button>

            <button
              type="button"
              className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-text hover:bg-border/60 transition-colors"
              onClick={onViewChanges}
            >
              {t("canvas.viewChangesAction")}
            </button>
          </div>
          {saveMessage && (
            <p role="status" className="mt-2 text-xs text-text-muted">
              {saveMessage}
              {saveHref && (
                <a href={saveHref} target="_blank" rel="noreferrer" className="ml-2 text-accent underline underline-offset-2">
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

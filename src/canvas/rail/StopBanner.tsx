import { useTranslation } from "../../i18n/i18nStore.ts";

export interface StopBannerProps {
  onResume: () => void;
  onCancel: () => void;
}

/** The agent is paused: continue where it stopped, or cancel the task. */
export function StopBanner({ onResume, onCancel }: StopBannerProps) {
  const { t } = useTranslation();
  return (
    <div
      role="alertdialog"
      aria-labelledby="stop-banner-title"
      data-testid="stop-banner"
      className="pointer-events-auto flex max-w-full animate-slide-up flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[rgba(248,81,73,0.55)] bg-[rgba(40,20,22,0.95)] px-4 py-2.5 text-[13.5px] shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
      <h2 id="stop-banner-title" className="font-semibold text-[#f4f5f8]" title={t("stages.stoppedText")}>
        {t("stages.stoppedTitle")}
      </h2>
      <div className="flex gap-2">
        <button type="button" onClick={onResume} className="rounded-lg border border-[#2ea043] bg-[#238636] px-3 py-1.5 font-semibold text-white hover:bg-[#2ea043]">
          {t("stages.resume")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#30363d] bg-[#1b1f28] px-3 py-1.5 text-[#e6edf3] hover:border-[rgba(248,81,73,0.6)]"
        >
          {t("stages.cancelTask")}
        </button>
      </div>
    </div>
  );
}

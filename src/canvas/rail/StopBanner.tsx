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
      className="flex max-w-md flex-col gap-3 rounded-xl border border-[rgba(248,81,73,0.45)] bg-[rgba(20,22,29,0.96)] p-4 text-sm shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-[3px] bg-[#f85149]" />
        <h2 id="stop-banner-title" className="font-semibold text-[#f4f5f8]">
          {t("stages.stoppedTitle")}
        </h2>
      </div>
      <p className="text-[#c9d1d9]">{t("stages.stoppedText")}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onResume} className="rounded-lg bg-[#238636] px-3 py-1.5 font-semibold text-white hover:bg-[#2ea043]">
          {t("stages.resume")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#30363d] px-3 py-1.5 text-[#ff7b72] hover:border-[rgba(248,81,73,0.6)]"
        >
          {t("stages.cancelTask")}
        </button>
      </div>
    </div>
  );
}

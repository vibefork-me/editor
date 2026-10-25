import { useI18n } from "../i18n/index.ts";
import { LanguageSwitcher } from "./LanguageSwitcher.tsx";

export type ConnectAiScreenProps = {
  isChecking?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
};

export function ConnectAiScreen({
  isChecking = false,
  errorMessage = null,
  onRetry,
}: ConnectAiScreenProps) {
  const { t } = useI18n();

  return (
    <div
      className="mx-auto w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900/90 p-6 sm:p-8 shadow-xl space-y-6 text-neutral-100"
      role="region"
      aria-live="polite"
      aria-label={t("connectAi.title")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold leading-snug text-neutral-100">
            {t("connectAi.title")}
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {t("connectAi.description")}
          </p>
        </div>
        <div className="shrink-0">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t("connectAi.whatWorksTitle")}
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3.5 space-y-1">
            <p className="text-sm font-medium text-neutral-200">
              {t("connectAi.optionSubscriptionTitle")}
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {t("connectAi.optionSubscriptionDescription")}
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3.5 space-y-1">
            <p className="text-sm font-medium text-neutral-200">
              {t("connectAi.optionOpenRouterTitle")}
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {t("connectAi.optionOpenRouterDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/40 p-4 space-y-1.5 text-left">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t("connectAi.howToConnectTitle")}
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {t("connectAi.howToConnectDescription")}
        </p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300"
        >
          {t("connectAi.errorNotice")}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={isChecking}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer"
        >
          {isChecking ? t("connectAi.checking") : t("connectAi.checkAgain")}
        </button>
        <a
          href="vibefork://start"
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-neutral-700 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          {t("connectAi.openAgent")}
        </a>
      </div>
    </div>
  );
}

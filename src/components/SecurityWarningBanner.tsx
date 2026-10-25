import { useState } from "react";
import { useI18n } from "../i18n/index.ts";

export type SecurityWarningBannerProps = {
  /** The agent is a development build that allows extra web origins. */
  active?: boolean;
};

/** Origins the agent always allows: the hosted editor and its own fallback UI on loopback. */
const BUILT_IN_ORIGIN = /^(https:\/\/code\.vibefork\.me|http:\/\/127\.0\.0\.1(:\d+)?)$/;

export function SecurityWarningBanner({ active = false }: SecurityWarningBannerProps) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!active) {
    return null;
  }

  // The agent does not reveal the list; a page outside the built-in origins can only be one of them.
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isCurrentOriginExtra = Boolean(currentOrigin && !BUILT_IN_ORIGIN.test(currentOrigin));

  if (dismissed) {
    return (
      <div className="bg-amber-950/40 border-b border-amber-500/20 px-6 py-1.5 flex items-center justify-between text-xs text-amber-300/80">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>{t("security.compactNotice")}</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="text-amber-400 hover:text-amber-200 underline font-medium text-xs cursor-pointer"
        >
          {t("security.showWarning")}
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-label={t("security.warningTitle")}
      className="bg-amber-950/80 border-b border-amber-500/40 px-6 py-3 text-amber-100 shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5 select-none" aria-hidden="true">
            ⚠️
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-200 text-sm">
                {t("security.warningTitle")}
              </span>
              {isCurrentOriginExtra ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  {t("security.currentOriginAllowed")}
                </span>
              ) : null}
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">{t("security.description")}</p>

            {showDetails ? (
              <div className="mt-2 rounded-md bg-neutral-950/70 border border-amber-600/30 p-2.5 text-xs text-neutral-300 space-y-1.5">
                <p>
                  <strong className="text-amber-300 font-medium">{t("security.detailsSecurityTitle")}</strong>{" "}
                  {t("security.detailsSecurityText")}
                </p>
                <p className="text-neutral-400">
                  {t("security.detailsDisableText")}
                </p>
              </div>
            ) : null}

            <div className="pt-0.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-amber-300 hover:text-amber-100 underline cursor-pointer"
              >
                {showDetails ? t("security.hideRiskDetails") : t("security.showRiskDetails")}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-amber-400 hover:text-amber-100 hover:bg-amber-900/50 transition cursor-pointer"
          title={t("security.dismissTitle")}
          aria-label={t("security.dismissTitle")}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

import { LOCALE_MARKS, LOCALE_NAMES, READY_LOCALES } from "../i18n/config.ts";
import { useI18n } from "../i18n/index.ts";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("language.selectLanguage")}
      className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-900/90 p-0.5 text-xs font-medium"
    >
      {READY_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => setLocale(l)}
          className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
            locale === l
              ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
          aria-label={LOCALE_NAMES[l]}
          aria-pressed={locale === l}
        >
          {LOCALE_MARKS[l]}
        </button>
      ))}
    </div>
  );
}

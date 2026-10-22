import { useI18n } from "../i18n/index.ts";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label="Выбор языка / Language selection"
      className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-900/90 p-0.5 text-xs font-medium"
    >
      <button
        type="button"
        onClick={() => setLocale("ru")}
        className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
          locale === "ru"
            ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
            : "text-neutral-400 hover:text-neutral-200"
        }`}
        aria-label="Русский язык"
        aria-pressed={locale === "ru"}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-md px-2.5 py-1 transition cursor-pointer ${
          locale === "en"
            ? "bg-neutral-800 text-neutral-100 font-semibold shadow-xs"
            : "text-neutral-400 hover:text-neutral-200"
        }`}
        aria-label="English language"
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}

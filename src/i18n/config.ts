import shared from "./shared/locales.json" with { type: "json" };

/**
 * The languages of the interface: the codes are listed here for their types, everything else comes from the
 * shared language list of every Vibefork product (`src/i18n/shared/locales.json`, copied by
 * `npm run sync:i18n`). `check:i18n` fails when the codes differ from the shared list.
 *
 * - `ready`: every key is translated; the check fails on a missing or extra key.
 * - `planned`: recognized from the browser and selectable in code, but not offered yet: its file may be
 *   missing or partial, and every missing key is shown in English.
 */
export const LOCALES_ALL = ["en", "ru", "pt-BR", "es-ES", "es-419", "de"] as const;

export type Locale = (typeof LOCALES_ALL)[number];

export type LocaleStatus = "ready" | "planned";

type SharedLocale = { code: string; name: string; mark: string; status: LocaleStatus };

const byCode = new Map((shared.locales as SharedLocale[]).map((l) => [l.code, l]));

function perLocale<T>(value: (l: SharedLocale) => T): Record<Locale, T> {
  return Object.fromEntries(
    LOCALES_ALL.map((code) => {
      const locale = byCode.get(code);
      if (!locale) throw new Error(`${code} is not in src/i18n/shared/locales.json`);
      return [code, value(locale)];
    }),
  ) as Record<Locale, T>;
}

export const LOCALE_STATUS: Record<Locale, LocaleStatus> = perLocale((l) => l.status);

/**
 * Each language named in itself, the same in every interface language, so a person finds theirs whatever
 * the current one is. Not in the dictionaries.
 */
export const LOCALE_NAMES: Record<Locale, string> = perLocale((l) => l.name);

/** The short mark of each language on a compact switch. */
export const LOCALE_MARKS: Record<Locale, string> = perLocale((l) => l.mark);

/** English is the source language: bundled into the first screen, and the fallback for every other one. */
export const SOURCE_LOCALE = "en" satisfies Locale;

/** The languages offered to people: fully translated ones. */
export const READY_LOCALES = LOCALES_ALL.filter((l) => LOCALE_STATUS[l] === "ready");

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALE_STATUS, value);
}

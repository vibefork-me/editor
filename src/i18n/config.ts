/**
 * The languages of the interface and how far each one is. Plain data with no imports, so the key check
 * (`scripts/check-i18n.mjs`) reads it too.
 *
 * - `ready`: every key is translated; the check fails on a missing or extra key.
 * - `declared`: recognized from the browser and selectable in code, but not translated yet: its file may
 *   be missing or partial, and every missing key is shown in English.
 */
export const LOCALE_STATUS = {
  en: "ready",
  ru: "ready",
  "pt-BR": "ready",
  es: "ready",
  de: "ready",
} as const;

export type Locale = keyof typeof LOCALE_STATUS;

/**
 * Each language named in itself, the same in every interface language, so a person finds theirs whatever
 * the current one is. Not in the dictionaries.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  "pt-BR": "Português (Brasil)",
  es: "Español",
  de: "Deutsch",
};

/** The short mark of each language on a compact switch. */
export const LOCALE_MARKS: Record<Locale, string> = {
  en: "EN",
  ru: "RU",
  "pt-BR": "PT",
  es: "ES",
  de: "DE",
};

/** English is the source language: bundled into the first screen, and the fallback for every other one. */
export const SOURCE_LOCALE = "en" satisfies Locale;

export const LOCALES_ALL = Object.keys(LOCALE_STATUS) as Locale[];

/** The languages offered to people: fully translated ones. */
export const READY_LOCALES = LOCALES_ALL.filter((l) => LOCALE_STATUS[l] === "ready");

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALE_STATUS, value);
}

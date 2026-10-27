import { create } from "zustand";
import { en } from "./locales/en.ts";
import { ru } from "./locales/ru.ts";
import type { Locale, TranslationKey, TranslationParams, TranslationSchema } from "./types.ts";

export const LOCALES: Record<Locale, TranslationSchema> = {
  ru,
  en,
};

export const STORAGE_KEY = "vf_locale";

// Belarusian and Kazakh readers get Russian; Ukrainian and every other language get English.
const RUSSIAN_READERS = ["ru", "be", "kk"];

/** The language for a browser language tag: Russian where people commonly read it, English otherwise. */
export function localeForLanguage(tag: string): Locale {
  const lang = tag.toLowerCase().split(/[-_]/)[0] ?? "";
  return RUSSIAN_READERS.includes(lang) ? "ru" : "en";
}

/** The person's choice, else by the browser's first language; English when it is unknown. */
export function detectInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ru" || stored === "en") {
        return stored;
      }
    } catch {
      // Storage might be restricted by browser policy
    }
    if (typeof navigator !== "undefined") {
      const langs = navigator.languages?.length ? navigator.languages : [navigator.language || ""];
      return localeForLanguage(langs[0] ?? "");
    }
  }
  return "en";
}

export function syncDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

function lookup(dictionary: TranslationSchema, key: string): unknown {
  let current: unknown = dictionary;
  for (const part of key.split(".")) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function translate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string {
  // The language asked for, then English; the key itself when neither has it.
  let current: unknown;
  for (const lang of locale === "en" ? (["en"] as const) : ([locale, "en"] as const)) {
    current = lookup(LOCALES[lang] ?? LOCALES.en, key);
    if (typeof current === "string") break;
  }

  if (typeof current !== "string") {
    return key;
  }

  if (params) {
    return current.replace(/\{(\w+)\}/g, (match, paramName: string) => {
      if (paramName in params) {
        return String(params[paramName]);
      }
      return match;
    });
  }

  return current;
}

export interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const initialLocale = detectInitialLocale();
syncDocumentLang(initialLocale);

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: initialLocale,
  setLocale: (nextLocale: Locale) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, nextLocale);
      }
    } catch {
      // Ignore localStorage errors
    }
    syncDocumentLang(nextLocale);
    set({ locale: nextLocale });
  },
  t: (key: TranslationKey, params?: TranslationParams) => {
    return translate(get().locale, key, params);
  },
}));

export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useI18nStore((s) => s.t);

  return { locale, setLocale, t };
}

export const useTranslation = useI18n;

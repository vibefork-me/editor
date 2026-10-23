import { create } from "zustand";
import { en } from "./locales/en.ts";
import { ru } from "./locales/ru.ts";
import type { Locale, TranslationKey, TranslationParams, TranslationSchema } from "./types.ts";

export const LOCALES: Record<Locale, TranslationSchema> = {
  ru,
  en,
};

export const STORAGE_KEY = "vf_locale";

export function detectInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ru" || stored === "en") {
        return stored;
      }
      const nav = (navigator.language || "").toLowerCase();
      if (nav.startsWith("ru") || nav.startsWith("be") || nav.startsWith("kk") || nav.startsWith("uk")) {
        return "ru";
      }
    } catch {
      // Storage might be restricted by browser policy
    }
  }
  return "ru";
}

export function syncDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function translate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string {
  const dictionary = LOCALES[locale] || LOCALES.ru;
  const parts = key.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  // Fallback to Russian if not found in current dictionary
  if (typeof current !== "string" && locale !== "ru") {
    let fallback: unknown = LOCALES.ru;
    for (const part of parts) {
      if (fallback && typeof fallback === "object" && part in fallback) {
        fallback = (fallback as Record<string, unknown>)[part];
      } else {
        fallback = undefined;
        break;
      }
    }
    if (typeof fallback === "string") {
      current = fallback;
    }
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

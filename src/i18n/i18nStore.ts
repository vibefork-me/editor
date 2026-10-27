import { create } from "zustand";
import { LOCALE_STATUS, SOURCE_LOCALE, isLocale, type Locale } from "./config.ts";
import { formatMessage, formatPseudo } from "./format.ts";
import { en } from "./locales/en.ts";
import type { PartialTranslation, TranslationKey, TranslationParams, TranslationSchema } from "./types.ts";

/**
 * Dictionaries loaded so far. English is bundled into the first screen; every other language is a separate
 * chunk, loaded when it is chosen (`loadLocale`).
 */
export const LOCALES: Partial<Record<Locale, TranslationSchema | PartialTranslation>> = {
  en,
};

// One file per language in `locales/`, named by its code (`ru.ts`, `pt-BR.ts`) and exporting the dictionary
// under the code without the dash (`ru`, `ptBR`). A declared language without a file is shown in English.
const LOADERS = import.meta.glob<Record<string, PartialTranslation>>(["./locales/*.ts", "!./locales/en.ts"]);

function loaderFor(locale: Locale): (() => Promise<Record<string, PartialTranslation>>) | undefined {
  return LOADERS[`./locales/${locale}.ts`];
}

const loading = new Map<Locale, Promise<void>>();

/** Whether `locale`'s dictionary is here (or it has none to load). */
export function isLocaleLoaded(locale: Locale): boolean {
  return locale in LOCALES || !loaderFor(locale);
}

/** Loads `locale`'s dictionary once; resolves when it is in `LOCALES`. A failed load leaves English. */
export function loadLocale(locale: Locale): Promise<void> {
  if (isLocaleLoaded(locale)) return Promise.resolve();
  let pending = loading.get(locale);
  if (!pending) {
    const load = loaderFor(locale)!;
    pending = load()
      .then((module) => {
        const dictionary = module[locale.replace("-", "")] ?? module.default;
        if (dictionary) LOCALES[locale] = dictionary;
      })
      .catch(() => {
        loading.delete(locale);
      });
    loading.set(locale, pending);
  }
  return pending;
}

export const STORAGE_KEY = "vf_locale";

// Belarusian and Kazakh readers get Russian; every Portuguese reader gets Brazilian Portuguese.
const LANGUAGE_LOCALES: Record<string, Locale> = {
  ru: "ru",
  be: "ru",
  kk: "ru",
  pt: "pt-BR",
  es: "es",
  de: "de",
};

/** The language for a browser language tag; English for one the editor does not know (Ukrainian too). */
export function localeForLanguage(tag: string): Locale {
  const lang = tag.toLowerCase().split(/[-_]/)[0] ?? "";
  return LANGUAGE_LOCALES[lang] ?? "en";
}

/** The person's choice, else by the browser's first language; English when it is unknown. */
export function detectInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) {
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

/** `<html lang>`: the language, or English while the language is not translated yet. */
export function syncDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = LOCALE_STATUS[locale] === "ready" ? locale : SOURCE_LOCALE;
  }
}

let pseudo = false;

/**
 * The pseudo-language (development): every dictionary text is accented, a third longer and in `⟦…⟧`, so
 * text written into the code, and layouts too tight for longer translations, stand out. On with `?pseudo`
 * in the address of the dev server.
 */
export function setPseudoLocale(on: boolean): void {
  pseudo = on;
}

function lookup(dictionary: TranslationSchema | PartialTranslation | undefined, key: string): unknown {
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

/**
 * The text of `key` in `locale` with `params` filled in (ICU plurals and numbers by the language's rules);
 * English when the language lacks the key or is not loaded yet, the key itself when English lacks it too.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string {
  const chain: Locale[] = locale === SOURCE_LOCALE ? [SOURCE_LOCALE] : [locale, SOURCE_LOCALE];
  for (const lang of chain) {
    const template = lookup(LOCALES[lang], key);
    if (typeof template === "string") {
      return pseudo ? formatPseudo(lang, template, params) : formatMessage(lang, template, params);
    }
  }
  return key;
}

export interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Changes when the language or its loaded dictionary changes, so components using it re-render. */
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

function translator(locale: Locale): I18nState["t"] {
  return (key, params) => translate(locale, key, params);
}

if (import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("pseudo")) {
  setPseudoLocale(true);
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
    set({ locale: nextLocale, t: translator(nextLocale) });
    if (!isLocaleLoaded(nextLocale)) {
      void loadLocale(nextLocale).then(() => {
        if (get().locale === nextLocale) set({ t: translator(nextLocale) });
      });
    }
  },
  t: translator(initialLocale),
}));

export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useI18nStore((s) => s.t);

  return { locale, setLocale, t };
}

export const useTranslation = useI18n;

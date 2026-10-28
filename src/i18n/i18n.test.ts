// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCALES,
  STORAGE_KEY,
  detectInitialLocale,
  isLocaleLoaded,
  loadLocale,
  localeForLanguage,
  setPseudoLocale,
  translate,
  useI18nStore,
} from "./i18nStore.ts";
import { en } from "./locales/en.ts";
import { de } from "./locales/de.ts";
import { es419 } from "./locales/es-419.ts";
import { esES } from "./locales/es-ES.ts";
import { ptBR } from "./locales/pt-BR.ts";
import { ru } from "./locales/ru.ts";
import { LOCALE_NAMES, LOCALE_STATUS, READY_LOCALES } from "./config.ts";

describe("i18n system", () => {
  beforeEach(() => {
    localStorage.clear();
    useI18nStore.getState().setLocale("ru");
  });

  it("has the English keys in every language", () => {
    function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      let keys: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object") {
          keys = keys.concat(getKeys(value as Record<string, unknown>, full));
        } else {
          keys.push(full);
        }
      }
      return keys.sort();
    }

    const enKeys = getKeys(en as unknown as Record<string, unknown>);
    for (const dictionary of [ru, ptBR, esES, es419, de]) {
      expect(getKeys(dictionary as unknown as Record<string, unknown>)).toEqual(enKeys);
    }
    expect(enKeys.length).toBeGreaterThan(15);
  });

  it("offers all six languages, each named in itself", () => {
    expect(READY_LOCALES).toEqual(["en", "ru", "pt-BR", "es-ES", "es-419", "de"]);
    expect(Object.values(LOCALE_STATUS).every((s) => s === "ready")).toBe(true);
    expect(LOCALE_NAMES).toEqual({
      en: "English",
      ru: "Русский",
      "pt-BR": "Português (Brasil)",
      "es-ES": "Español (España)",
      "es-419": "Español (Latinoamérica)",
      de: "Deutsch",
    });
  });

  it("translates keys in Russian and English", () => {
    expect(translate("ru", "common.appTitle")).toBe("Vibefork editor");
    expect(translate("ru", "agentOffline.openAgent")).toBe("Открыть агент");
    expect(translate("en", "agentOffline.openAgent")).toBe("Open agent");
  });

  it("interpolates parameters correctly", () => {
    const textRu = translate("ru", "agentOffline.networkBlockedDescription", {
      domain: "code.vibefork.me",
    });
    expect(textRu).toContain("для сайта code.vibefork.me");

    const textEn = translate("en", "agentOffline.networkBlockedDescription", {
      domain: "code.vibefork.me",
    });
    expect(textEn).toContain("for site code.vibefork.me");
  });

  it("falls back to key string when translation key does not exist", () => {
    expect(translate("ru", "non.existent.key")).toBe("non.existent.key");
  });

  it("detects stored locale from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "en");
    expect(detectInitialLocale()).toBe("en");

    localStorage.setItem(STORAGE_KEY, "ru");
    expect(detectInitialLocale()).toBe("ru");
  });

  it("updates locale via store and reflects in t function", () => {
    const store = useI18nStore.getState();
    expect(store.locale).toBe("ru");
    expect(store.t("common.copy")).toBe("Копировать");

    store.setLocale("en");
    expect(useI18nStore.getState().locale).toBe("en");
    expect(useI18nStore.getState().t("common.copy")).toBe("Copy");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");
  });

  describe("the language of a first visit", () => {
    afterEach(() => vi.restoreAllMocks());
    const browser = (languages: string[]) => {
      localStorage.clear();
      vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
      vi.spyOn(navigator, "language", "get").mockReturnValue(languages[0] ?? "");
    };

    it("is Russian for Russian, Belarusian and Kazakh browsers", () => {
      for (const tag of ["ru", "ru-RU", "be-BY", "kk"]) {
        browser([tag]);
        expect(detectInitialLocale()).toBe("ru");
      }
    });

    it("is English for Ukrainian and for any language it does not know", () => {
      for (const tag of ["uk", "uk-UA", "fr", "zh-CN", "en-GB", ""]) {
        browser([tag]);
        expect(detectInitialLocale()).toBe("en");
      }
      browser([]);
      expect(detectInitialLocale()).toBe("en");
    });

    it("is Brazilian Portuguese for any Portuguese, Spain's Spanish for Spain and Latin American for any other, German for its variants", () => {
      for (const [tag, locale] of [
        ["pt", "pt-BR"],
        ["pt-BR", "pt-BR"],
        ["pt-PT", "pt-BR"],
        ["es", "es-419"],
        ["es-419", "es-419"],
        ["es-MX", "es-419"],
        ["es-AR", "es-419"],
        ["es-US", "es-419"],
        ["es-ES", "es-ES"],
        ["es-es", "es-ES"],
        ["de", "de"],
        ["de-AT", "de"],
        ["de-CH", "de"],
      ] as const) {
        browser([tag]);
        expect(detectInitialLocale()).toBe(locale);
      }
      expect(localeForLanguage("pt_BR")).toBe("pt-BR");
      expect(localeForLanguage("es_ES")).toBe("es-ES");
    });

    it("keeps the person's choice over the browser", () => {
      browser(["de"]);
      localStorage.setItem(STORAGE_KEY, "ru");
      expect(detectInitialLocale()).toBe("ru");
    });
  });

  it("falls back to English for a key missing in Russian", () => {
    const ruCommon = LOCALES.ru!.common as Record<string, string>;
    const saved = ruCommon.copy;
    delete ruCommon.copy;
    try {
      expect(translate("ru", "common.copy")).toBe("Copy");
    } finally {
      ruCommon.copy = saved!;
    }
  });

  it("translates Portuguese, Spanish and German, and puts the language in <html lang>", async () => {
    await Promise.all([loadLocale("pt-BR"), loadLocale("es-ES"), loadLocale("es-419"), loadLocale("de")]);
    expect(translate("pt-BR", "agentOffline.openAgent")).toBe("Abrir o agente");
    expect(translate("es-ES", "agentOffline.notRunningTitle")).toContain("ordenador");
    expect(translate("es-419", "agentOffline.notRunningTitle")).toContain("computadora");
    expect(translate("de", "agentOffline.openAgent")).toBe("Agenten öffnen");
    useI18nStore.getState().setLocale("de");
    expect(useI18nStore.getState().t("common.copy")).toBe("Kopieren");
    expect(document.documentElement.lang).toBe("de");
    useI18nStore.getState().setLocale("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("keeps a stored language", () => {
    localStorage.setItem(STORAGE_KEY, "es-ES");
    expect(detectInitialLocale()).toBe("es-ES");
    localStorage.setItem(STORAGE_KEY, "xx");
    expect(["ru", "en"]).toContain(detectInitialLocale());
  });

  it("moves a choice of the former single Spanish to Latin American Spanish", () => {
    localStorage.setItem(STORAGE_KEY, "es");
    expect(detectInitialLocale()).toBe("es-419");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("es-419");
  });

  it("bundles only English; Russian comes as its own chunk", async () => {
    expect(isLocaleLoaded("en")).toBe(true);
    await loadLocale("ru");
    expect(isLocaleLoaded("ru")).toBe(true);
    expect(LOCALES.ru).toBe(ru);
    await loadLocale("de");
    expect(LOCALES.de).toBe(de);
  });

  it("chooses plural forms by the language's rules", () => {
    expect(translate("en", "messages.tooMany", { count: 1 })).toBe("Up to 1 attachment");
    expect(translate("en", "messages.tooMany", { count: 5 })).toBe("Up to 5 attachments");
    expect(translate("ru", "messages.tooMany", { count: 1 })).toBe("Не больше 1 вложения");
    expect(translate("ru", "messages.tooMany", { count: 3 })).toBe("Не больше 3 вложений");
    expect(translate("ru", "messages.tooMany", { count: 21 })).toBe("Не больше 21 вложения");
  });

  it("chooses Portuguese, Spanish and German plural forms", async () => {
    await Promise.all([loadLocale("pt-BR"), loadLocale("es-ES"), loadLocale("es-419"), loadLocale("de")]);
    expect(translate("pt-BR", "messages.tooMany", { count: 1 })).toBe("Até 1 anexo");
    expect(translate("pt-BR", "messages.tooMany", { count: 2 })).toBe("Até 2 anexos");
    for (const locale of ["es-ES", "es-419"] as const) {
      expect(translate(locale, "messages.tooMany", { count: 1 })).toBe("Hasta 1 adjunto");
      expect(translate(locale, "messages.tooMany", { count: 5 })).toBe("Hasta 5 adjuntos");
    }
    expect(translate("de", "messages.tooMany", { count: 1 })).toBe("Bis zu 1 Anhang");
    expect(translate("de", "messages.tooMany", { count: 3 })).toBe("Bis zu 3 Anhänge");
    expect(translate("de", "outcome.filesChanged", { count: 1000 })).toBe("1.000 Dateien geändert");
  });

  it("marks every dictionary text in the pseudo-language and leaves values as they are", () => {
    setPseudoLocale(true);
    try {
      const text = translate("en", "agentOffline.networkBlockedDescription", { domain: "code.vibefork.me" });
      expect(text.startsWith("⟦") && text.endsWith("⟧")).toBe(true);
      expect(text).toContain("code.vibefork.me");
      expect(text).not.toContain("allow");
      expect(translate("en", "messages.tooMany", { count: 2 })).toBe("⟦Ûþ ţö ··2 àţţàçĥɱéñţš····⟧");
    } finally {
      setPseudoLocale(false);
    }
  });
});

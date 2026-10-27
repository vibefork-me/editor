// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCALES,
  STORAGE_KEY,
  detectInitialLocale,
  localeForLanguage,
  translate,
  useI18nStore,
} from "./i18nStore.ts";
import { en } from "./locales/en.ts";
import { ru } from "./locales/ru.ts";

describe("i18n system", () => {
  beforeEach(() => {
    localStorage.clear();
    useI18nStore.getState().setLocale("ru");
  });

  it("has identical structure between ru and en locales", () => {
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

    const ruKeys = getKeys(ru as unknown as Record<string, unknown>);
    const enKeys = getKeys(en as unknown as Record<string, unknown>);

    expect(ruKeys).toEqual(enKeys);
    expect(ruKeys.length).toBeGreaterThan(15);
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
      for (const tag of ["uk", "uk-UA", "de-DE", "fr", "zh-CN", "en-GB", ""]) {
        browser([tag]);
        expect(detectInitialLocale()).toBe("en");
      }
      browser([]);
      expect(detectInitialLocale()).toBe("en");
      expect(localeForLanguage("pt_BR")).toBe("en");
    });

    it("keeps the person's choice over the browser", () => {
      browser(["de"]);
      localStorage.setItem(STORAGE_KEY, "ru");
      expect(detectInitialLocale()).toBe("ru");
    });
  });

  it("falls back to English for a key missing in Russian", () => {
    const ruCommon = LOCALES.ru.common as Record<string, string>;
    const saved = ruCommon.copy;
    delete ruCommon.copy;
    try {
      expect(translate("ru", "common.copy")).toBe("Copy");
    } finally {
      ruCommon.copy = saved!;
    }
  });
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  detectInitialLocale,
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

    const textEn = translate("en", "security.compactNotice", {
      count: 2,
      origins: "http://localhost:5173, http://127.0.0.1:3000",
    });
    expect(textEn).toBe("External origins allowed (2): http://localhost:5173, http://127.0.0.1:3000");
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
});

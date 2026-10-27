// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "../i18n/index.ts";
import { LanguageSwitcher } from "./LanguageSwitcher.tsx";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    useI18nStore.getState().setLocale("ru");
  });

  it("offers every language, the current one pressed", () => {
    render(<LanguageSwitcher />);

    const ruBtn = screen.getByRole("button", { name: "Русский" });
    const enBtn = screen.getByRole("button", { name: "English" });

    expect(ruBtn.getAttribute("aria-pressed")).toBe("true");
    expect(enBtn.getAttribute("aria-pressed")).toBe("false");
    for (const name of ["Português (Brasil)", "Español", "Deutsch"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("false");
    }
    expect(screen.getByRole("button", { name: "Deutsch" }).textContent).toBe("DE");
  });

  it("switches language on click", () => {
    render(<LanguageSwitcher />);

    const enBtn = screen.getByRole("button", { name: "English" });
    fireEvent.click(enBtn);

    expect(useI18nStore.getState().locale).toBe("en");
    expect(enBtn.getAttribute("aria-pressed")).toBe("true");

    const ruBtn = screen.getByRole("button", { name: "Русский" });
    expect(ruBtn.getAttribute("aria-pressed")).toBe("false");
  });
});

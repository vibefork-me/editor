import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { loadLocale } from "../i18n/i18nStore.ts";

// Tests switch languages synchronously: load every dictionary up front, as the app does for the first one.
await loadLocale("ru");

afterEach(() => {
  cleanup();
});

// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProvider } from "../client/types.ts";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { ConnectAiScreen } from "./ConnectAiScreen.tsx";

const p = (id: string, kind: AiProvider["kind"], connected: AiProvider["connected"] = "no"): AiProvider => ({
  id,
  kind,
  installed: true,
  installing: false,
  connected,
});

describe("ConnectAiScreen", () => {
  beforeEach(() => useI18nStore.getState().setLocale("ru"));

  it("keeps connected AIs compact and disconnects one from its menu", () => {
    const onDisconnect = vi.fn();
    render(
      <ConnectAiScreen
        providers={[p("claude", "subscription", "yes"), p("codex", "subscription"), p("openrouter", "free")]}
        onDisconnect={onDisconnect}
      />,
    );
    expect(screen.getByRole("heading", { name: "Подключено" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Добавить ИИ" })).toBeTruthy();
    expect(screen.queryByTestId("disconnect-claude")).toBeNull();
    fireEvent.click(screen.getByTestId("actions-claude"));
    fireEvent.click(screen.getByTestId("disconnect-claude"));
    expect(onDisconnect).toHaveBeenCalledWith("claude");
  });

  it("shows a search once the catalog is long and filters it", () => {
    const many = [
      p("claude", "subscription"),
      p("codex", "subscription"),
      p("openrouter", "free"),
      p("custom", "custom"),
      ...["a", "b", "c", "d"].map((x) => p(`extra-${x}`, "free")),
    ];
    render(<ConnectAiScreen providers={many} />);
    const search = screen.getByRole("searchbox", { name: "Найти ИИ" });
    fireEvent.change(search, { target: { value: "openrouter" } });
    expect(screen.getByTestId("provider-card-openrouter")).toBeTruthy();
    expect(screen.queryByTestId("provider-card-claude")).toBeNull();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Ничего не найдено")).toBeTruthy();
  });
});

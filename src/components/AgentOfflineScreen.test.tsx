// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentOfflineScreen } from "./AgentOfflineScreen.tsx";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { WINDOWS_INSTALL_PS_COMMAND } from "../client/probe-agent-reachability.ts";

describe("AgentOfflineScreen", () => {
  // The texts checked here are the Russian ones.
  beforeEach(() => useI18nStore.getState().setLocale("ru"));

  it("renders agent-not-running state with deep link and install command", () => {
    render(<AgentOfflineScreen reason="agent-not-running" />);

    expect(
      screen.getByRole("heading", { name: /Vibefork Agent не запущен/i }),
    ).toBeTruthy();
    const openLink = screen.getByRole("link", { name: /Открыть агент/i });
    expect(openLink.getAttribute("href")).toBe("vibefork://start");
    expect(screen.getByText(WINDOWS_INSTALL_PS_COMMAND)).toBeTruthy();
  });

  it("renders local-network-blocked instructions", () => {
    render(<AgentOfflineScreen reason="local-network-blocked" />);
    expect(screen.getByRole("heading", { name: /ограничил доступ/i })).toBeTruthy();
    expect(screen.getByText(/Google Chrome или Microsoft Edge/i)).toBeTruthy();
    expect(screen.getByText(/Mozilla Firefox/i)).toBeTruthy();
  });

  it("copies install command to clipboard", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<AgentOfflineScreen reason="agent-not-running" />);
    fireEvent.click(screen.getByRole("button", { name: /Копировать/i }));

    expect(writeText).toHaveBeenCalledWith(WINDOWS_INSTALL_PS_COMMAND);
  });
});

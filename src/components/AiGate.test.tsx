// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AiGate } from "./AiGate.tsx";
import { OpenPage } from "../pages/OpenPage.tsx";
import { useSessionStore } from "../stores/sessionStore.ts";
import { useI18nStore } from "../i18n/i18nStore.ts";

const mocks = vi.hoisted(() => ({
  client: {
    getAiStatus: vi.fn(),
    connectAi: vi.fn(),
    getModels: vi.fn(),
    importProject: vi.fn(),
    runBuild: vi.fn(),
  },
}));

vi.mock("../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => mocks.client,
}));

describe("AiGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useI18nStore.getState().setLocale("ru");
    useSessionStore.setState({ bearerToken: "test-token" });
  });

  it("shows provider cards when AI is not ready", async () => {
    mocks.client.getAiStatus.mockResolvedValue({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "no" },
        { id: "codex", kind: "subscription", installed: false, connected: "no" },
        { id: "openrouter", kind: "free", installed: true, connected: "no" },
      ],
    });

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();

    // Claude is installed -> shows "Войти" button
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Войти/i })).toBeTruthy();

    // Codex is not installed -> shows "Не установлен (скоро)"
    expect(screen.getByText("ChatGPT (Codex)")).toBeTruthy();
    expect(screen.getByText(/Не установлен \(скоро\)/i)).toBeTruthy();

    // OpenRouter -> shows "Скоро"
    expect(screen.getByText("OpenRouter")).toBeTruthy();
    expect(screen.getByText("Скоро")).toBeTruthy();

    // Link to launch agent
    expect(
      screen.getByRole("link", { name: /Открыть агент/i }).getAttribute("href"),
    ).toBe("vibefork://start");

    expect(screen.queryByText("Protected editor workspace")).toBeNull();
  });

  it("renders children immediately when AI is already ready", async () => {
    mocks.client.getAiStatus.mockResolvedValue({
      ready: true,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "yes" },
        { id: "codex", kind: "subscription", installed: true, connected: "no" },
      ],
    });

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(await screen.findByText("Protected editor workspace")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeNull();
  });

  it("starts connect on click 'Войти', shows browser confirmation notice and unblocks on ready", async () => {
    // 1. Initial state: not ready
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "no" },
      ],
    });
    mocks.client.connectAi.mockResolvedValue({ started: true });

    render(
      <AiGate pollIntervalMs={30}>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    const signInButton = await screen.findByRole("button", { name: /Войти/i });
    expect(signInButton).toBeTruthy();

    // Setup polling response: next check returns ready: true
    mocks.client.getAiStatus.mockResolvedValue({
      ready: true,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "yes" },
      ],
    });

    // 2. Click "Войти"
    fireEvent.click(signInButton);

    expect(mocks.client.connectAi).toHaveBeenCalledWith("claude");
    expect(
      await screen.findByText(/Подтвердите в окне агента и войдите в браузере…/i),
    ).toBeTruthy();

    // 3. Polling runs and picks up ready: true
    await waitFor(() => {
      expect(screen.getByText("Protected editor workspace")).toBeTruthy();
    });
  });

  it("displays error notice when getAiStatus fails and allows retry", async () => {
    mocks.client.getAiStatus.mockRejectedValueOnce(new Error("Network failure"));

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Не удалось получить список моделей/i)).toBeTruthy();

    // Retry succeeds
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: true,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "yes" },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Проверить снова/i }));
    expect(await screen.findByText("Protected editor workspace")).toBeTruthy();
  });

  it("gates /open: blocks import and build until AI is ready", async () => {
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "no" },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/open?repo=vibefork-me/demo&ref=main"]}>
        <AiGate>
          <Routes>
            <Route path="/open" element={<OpenPage />} />
          </Routes>
        </AiGate>
      </MemoryRouter>,
    );

    // Initial state: Connect AI screen is shown; OpenPage is NOT shown
    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Взять этот код/i })).toBeNull();
    expect(screen.queryByText("vibefork-me/demo")).toBeNull();

    // AI is connected and check is repeated
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: true,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "yes" },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Проверить снова/i }));

    // Now OpenPage is rendered and import is available
    expect(await screen.findByText("vibefork-me/demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Взять этот код/i })).toBeTruthy();
  });

  it("supports language switching on the Connect AI screen", async () => {
    mocks.client.getAiStatus.mockResolvedValue({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "no" },
        { id: "codex", kind: "subscription", installed: false, connected: "no" },
      ],
    });

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();
    expect(screen.getAllByText("Подписка").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();

    // Switch to English
    fireEvent.click(screen.getByRole("button", { name: /English language/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Connect an AI model/i })).toBeTruthy();
    });
    expect(screen.getAllByText("Subscription").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByText(/Not installed \(coming soon\)/i)).toBeTruthy();

    // Switch back to Russian
    fireEvent.click(screen.getByRole("button", { name: /Русский язык/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Подключите искусственный интеллект/i }),
      ).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();
  });
});

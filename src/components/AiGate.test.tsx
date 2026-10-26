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
        { id: "claude", kind: "subscription", installed: true, installing: false, connected: "no" },
        { id: "codex", kind: "subscription", installed: false, installing: false, connected: "no" },
        { id: "openrouter", kind: "free", installed: true, installing: false, connected: "no" },
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
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();

    // Codex is not installed -> shows "Установить и войти" button
    expect(screen.getByText("ChatGPT (Codex)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Установить и войти" })).toBeTruthy();

    // OpenRouter -> shows "Ввести ключ" button and link to get free key
    expect(screen.getByText("OpenRouter")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ввести ключ/i })).toBeTruthy();
    const keyLink = screen.getByRole("link", { name: /Получить бесплатный ключ/i });
    expect(keyLink.getAttribute("href")).toBe("https://openrouter.ai/keys");

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

    const signInButton = await screen.findByRole("button", { name: "Войти" });
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

  it("keeps waiting for Claude when another AI is ready already (panel from the status bar)", async () => {
    const { useAiPanelStore } = await import("../stores/aiPanelStore.ts");
    const openrouterOnly = {
      ready: true,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "no" },
        { id: "openrouter", kind: "free", installed: true, connected: "yes" },
      ],
    };
    mocks.client.getAiStatus.mockResolvedValue(openrouterOnly);
    mocks.client.connectAi.mockResolvedValue({ started: true });
    useAiPanelStore.setState({ open: true });

    render(
      <AiGate pollIntervalMs={30}>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    const signIn = await screen.findByRole("button", { name: "Войти" });
    fireEvent.click(signIn);
    expect(await screen.findByText(/Подтвердите в окне агента/i)).toBeTruthy();

    // A few polls with Claude still signing in: the card keeps waiting.
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByText(/Подтвердите в окне агента/i)).toBeTruthy();

    // Claude signed in: the card shows it without reopening the panel.
    mocks.client.getAiStatus.mockResolvedValue({
      ready: true,
      providers: [
        { id: "claude", kind: "subscription", installed: true, connected: "yes" },
        { id: "openrouter", kind: "free", installed: true, connected: "yes" },
      ],
    });
    await waitFor(() => {
      const card = screen.getByTestId("provider-card-claude");
      expect(card.textContent).toMatch(/Подключено|Connected/);
    });
    useAiPanelStore.setState({ open: false });
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

  it("handles OpenRouter key entry, cancellation, invalid key 400 error, and success", async () => {
    mocks.client.getAiStatus.mockResolvedValue({
      ready: false,
      providers: [
        { id: "openrouter", kind: "free", installed: true, installing: false, connected: "no" },
      ],
    });

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    const enterKeyBtn = await screen.findByRole("button", { name: /Ввести ключ/i });
    expect(enterKeyBtn).toBeTruthy();

    // 1. Cancellation / empty key -> started: false (button is restored without error)
    mocks.client.connectAi.mockResolvedValueOnce({ started: false });
    fireEvent.click(enterKeyBtn);
    expect(mocks.client.connectAi).toHaveBeenCalledWith("openrouter");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Ввести ключ/i })).toBeTruthy();
    });
    expect(screen.queryByRole("alert")).toBeNull();

    // 2. Invalid key -> 400 Bad Request error
    const badKeyError = new Error("invalid OpenRouter key: 401 Unauthorized");
    (badKeyError as { status?: number }).status = 400;
    mocks.client.connectAi.mockRejectedValueOnce(badKeyError);

    fireEvent.click(screen.getByRole("button", { name: /Ввести ключ/i }));

    expect(
      await screen.findByText(/Ключ не принят OpenRouter, проверьте и попробуйте снова/i),
    ).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ввести ключ/i })).toBeTruthy();

    // 3. Valid key -> started: true, getAiStatus returns ready: true -> unblocks workspace
    mocks.client.connectAi.mockResolvedValueOnce({ started: true });
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: true,
      providers: [
        { id: "openrouter", kind: "free", installed: true, installing: false, connected: "yes" },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Ввести ключ/i }));

    expect(await screen.findByText("Protected editor workspace")).toBeTruthy();
  });

  it("handles uninstalled CLI installation and installing notice", async () => {
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: false, installing: false, connected: "no" },
      ],
    });

    render(
      <AiGate pollIntervalMs={20}>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    const installBtn = await screen.findByRole("button", { name: /Установить и войти/i });
    expect(installBtn).toBeTruthy();

    mocks.client.connectAi.mockResolvedValueOnce({ started: true });
    // Next poll returns installing: true
    mocks.client.getAiStatus.mockResolvedValueOnce({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: false, installing: true, connected: "no" },
      ],
    });

    fireEvent.click(installBtn);
    expect(mocks.client.connectAi).toHaveBeenCalledWith("claude");

    expect(
      await screen.findByText(/Устанавливаю официальное приложение… \(загрузка до ~300 МБ\)/i),
    ).toBeTruthy();
  });

  it("supports language switching on the Connect AI screen", async () => {
    mocks.client.getAiStatus.mockResolvedValue({
      ready: false,
      providers: [
        { id: "claude", kind: "subscription", installed: true, installing: false, connected: "no" },
        { id: "codex", kind: "subscription", installed: false, installing: false, connected: "no" },
        { id: "openrouter", kind: "free", installed: true, installing: false, connected: "no" },
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
    expect(screen.getByRole("button", { name: "Установить и войти" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ввести ключ" })).toBeTruthy();

    // Switch to English
    fireEvent.click(screen.getByRole("button", { name: /English language/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Connect an AI model/i })).toBeTruthy();
    });
    expect(screen.getAllByText("Subscription").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Install and sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enter key" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get a free key" })).toBeTruthy();

    // Switch back to Russian
    fireEvent.click(screen.getByRole("button", { name: /Русский язык/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Подключите искусственный интеллект/i }),
      ).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Установить и войти" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ввести ключ" })).toBeTruthy();
  });
});

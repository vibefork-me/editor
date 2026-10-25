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

  it("shows Connect AI screen when getModels returns empty list", async () => {
    mocks.client.getModels.mockResolvedValue([]);

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();
    expect(screen.getByText(/Подписка Claude или ChatGPT/i)).toBeTruthy();
    expect(screen.getByText(/Бесплатная модель OpenRouter/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Проверить снова/i })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Открыть агент/i }).getAttribute("href"),
    ).toBe("vibefork://start");
    expect(screen.queryByText("Protected editor workspace")).toBeNull();
  });

  it("renders children immediately when models are already connected", async () => {
    mocks.client.getModels.mockResolvedValue([
      {
        provider: "anthropic",
        model: "claude-3-7-sonnet",
        label: "Claude 3.7 Sonnet",
        cost: "paid",
        tier: 0,
      },
    ]);

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

  it("unblocks and renders workspace when user clicks check again after connecting AI", async () => {
    // 1. Initial check: no models
    mocks.client.getModels.mockResolvedValueOnce([]);

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();
    expect(screen.queryByText("Protected editor workspace")).toBeNull();

    // 2. User sets up AI in the agent, then clicks "Check again"
    mocks.client.getModels.mockResolvedValueOnce([
      {
        provider: "openrouter",
        model: "free-model",
        label: "Free Model",
        cost: "free",
        tier: 0,
      },
    ]);

    const checkButton = screen.getByRole("button", { name: /Проверить снова/i });
    fireEvent.click(checkButton);

    expect(await screen.findByText("Protected editor workspace")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeNull();
  });

  it("displays error notice when getModels fails and allows retry", async () => {
    mocks.client.getModels.mockRejectedValueOnce(new Error("Network failure"));

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
    expect(screen.queryByText("Protected editor workspace")).toBeNull();

    // Retry succeeds with models
    mocks.client.getModels.mockResolvedValueOnce([
      {
        provider: "openai",
        model: "gpt-4o",
        label: "GPT-4o",
        cost: "paid",
        tier: 0,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Проверить снова/i }));
    expect(await screen.findByText("Protected editor workspace")).toBeTruthy();
  });

  it("gates /open: blocks import and build until AI is connected", async () => {
    mocks.client.getModels.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/open?repo=vibefork-me/demo&ref=main"]}>
        <AiGate>
          <Routes>
            <Route path="/open" element={<OpenPage />} />
          </Routes>
        </AiGate>
      </MemoryRouter>,
    );

    // Initial state: Connect AI screen is shown; OpenPage import action is NOT shown
    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Взять этот код/i })).toBeNull();
    expect(screen.queryByText("vibefork-me/demo")).toBeNull();

    // AI is connected and user retries
    mocks.client.getModels.mockResolvedValueOnce([
      {
        provider: "anthropic",
        model: "claude-3-7-sonnet",
        label: "Claude 3.7",
        cost: "paid",
        tier: 0,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Проверить снова/i }));

    // Now OpenPage is rendered and import is available
    expect(await screen.findByText("vibefork-me/demo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Взять этот код/i })).toBeTruthy();
  });

  it("supports language switching on the Connect AI screen", async () => {
    mocks.client.getModels.mockResolvedValue([]);

    render(
      <AiGate>
        <p>Protected editor workspace</p>
      </AiGate>,
    );

    expect(
      await screen.findByRole("heading", { name: /Подключите искусственный интеллект/i }),
    ).toBeTruthy();

    // Switch to English
    fireEvent.click(screen.getByRole("button", { name: /English language/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Connect an AI model/i })).toBeTruthy();
    });
    expect(screen.getByText(/Claude or ChatGPT subscription/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Check again/i })).toBeTruthy();

    // Switch back to Russian
    fireEvent.click(screen.getByRole("button", { name: /Русский язык/i }));
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Подключите искусственный интеллект/i }),
      ).toBeTruthy();
    });
  });
});

/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { useProjectStore } from "../stores/projectStore.ts";
import { AgentApiError } from "../client/types.ts";
import { OpenPage } from "./OpenPage.tsx";

const mockImportProject = vi.fn();
const mockConnectGithub = vi.fn();
const mockGetGithubStatus = vi.fn();

vi.mock("../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => ({
    importProject: mockImportProject,
    connectGithub: mockConnectGithub,
    getGithubStatus: mockGetGithubStatus,
  }),
}));

describe("OpenPage unified flow", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useProjectStore.getState().clearForeignChanges();
    mockImportProject.mockReset();
    mockConnectGithub.mockReset();
    mockGetGithubStatus.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders error state when repo query parameter is invalid", () => {
    render(
      <MemoryRouter initialEntries={["/open?repo=invalid-repo"]}>
        <OpenPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/missing repo/i)).toBeTruthy();
  });

  it("imports project and immediately redirects to /{projectId} with foreign changes", async () => {
    mockImportProject.mockResolvedValueOnce({
      project: "my-project",
      repo: "owner/repo",
      ref: "pull/42/head",
      foreign: {
        source: "owner/repo@pull/42/head",
        files: 3,
        dependencies: ["package.json"],
        buildScripts: ["build.sh"],
        binaries: [],
        complete: true,
        compareUrl: "https://github.com/owner/repo/pull/42",
      },
    });

    let currentPath = "/open?repo=owner/repo&ref=pull/42/head";

    render(
      <MemoryRouter initialEntries={[currentPath]}>
        <Routes>
          <Route path="/open" element={<OpenPage />} />
          <Route
            path="/:projectId"
            element={
              <div data-testid="workspace">
                <span>Workspace loaded</span>
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("owner/repo")).toBeTruthy();
    expect(screen.getByText("pull/42/head")).toBeTruthy();
    expect(screen.getByText(/code not from the original/i)).toBeTruthy();

    const takeBtn = screen.getByRole("button", { name: /take this code|взять этот код/i });
    fireEvent.click(takeBtn);

    await waitFor(() => {
      expect(mockImportProject).toHaveBeenCalledWith({
        repo: "owner/repo",
        ref: "pull/42/head",
        upstream: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("workspace")).toBeTruthy();
    });

    // Foreign changes must be stored in projectStore for the workspace
    expect(useProjectStore.getState().foreignChanges?.project).toBe("my-project");
    expect(useProjectStore.getState().foreignChanges?.foreign.files).toBe(3);
    expect(useProjectStore.getState().foreignChanges?.foreign.dependencies).toEqual(["package.json"]);
  });

  it("surfaces human-readable import error on failure", async () => {
    mockImportProject.mockRejectedValueOnce(new Error("Git clone failed: repo not found"));

    render(
      <MemoryRouter initialEntries={["/open?repo=owner/repo"]}>
        <OpenPage />
      </MemoryRouter>
    );

    const takeBtn = screen.getByRole("button", { name: /take this code|взять этот код/i });
    fireEvent.click(takeBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText(/Git clone failed: repo not found/i)).toBeTruthy();
    });
  });

  it("displays rate limit notice and handles GitHub device flow with auto-retry", async () => {
    // 1. Initial attempt fails with rate limit error
    mockImportProject.mockRejectedValueOnce(
      new AgentApiError("GitHub's limit of requests is reached", 429, {
        code: "rate_limit",
        resetMinutes: 38,
      })
    );

    mockConnectGithub.mockResolvedValueOnce({
      userCode: "ABCD-1234",
      verificationUri: "https://github.com/login/device",
      expiresIn: 900,
    });

    // When status is polled, return connected: true
    mockGetGithubStatus.mockResolvedValueOnce({
      connected: true,
      pending: false,
      login: "test-user",
      error: null,
    });

    // Second import call succeeds
    mockImportProject.mockResolvedValueOnce({
      project: "retried-project",
      repo: "owner/repo",
    });

    render(
      <MemoryRouter initialEntries={["/open?repo=owner/repo"]}>
        <Routes>
          <Route path="/open" element={<OpenPage />} />
          <Route
            path="/:projectId"
            element={
              <div data-testid="workspace">
                <span>Workspace loaded</span>
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    const takeBtn = screen.getByRole("button", { name: /take this code/i });
    fireEvent.click(takeBtn);

    // Rate limit card should appear with 38 minutes and login button
    await waitFor(() => {
      expect(screen.getByText(/GitHub request limit reached/i)).toBeTruthy();
      expect(screen.getByText(/Try again in 38 min/i)).toBeTruthy();
      expect(screen.getByText(/Signing in to GitHub increases the limit to 5000/i)).toBeTruthy();
    });

    const signInBtn = screen.getByRole("button", { name: /Sign in to GitHub/i });
    fireEvent.click(signInBtn);

    // Shows code and verification link
    await waitFor(() => {
      expect(mockConnectGithub).toHaveBeenCalled();
      expect(screen.getByTestId("github-user-code").textContent).toBe("ABCD-1234");
      expect(screen.getByText(/Open verification page/i)).toBeTruthy();
      expect(screen.getByText(/Waiting for authorization/i)).toBeTruthy();
    });

    // Copy button test
    const copyBtn = screen.getByRole("button", { name: /^Copy$/i });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABCD-1234");

    // After polling detects connected: true, takeCode is re-invoked and redirects
    await waitFor(
      () => {
        expect(mockImportProject).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId("workspace")).toBeTruthy();
      },
      { timeout: 4000 }
    );
  });

  it("displays rate limit in Russian locale", async () => {
    useI18nStore.getState().setLocale("ru");

    mockImportProject.mockRejectedValueOnce(
      new AgentApiError("GitHub's limit of requests is reached", 429, {
        code: "rate_limit",
        resetMinutes: 25,
      })
    );

    render(
      <MemoryRouter initialEntries={["/open?repo=owner/repo"]}>
        <OpenPage />
      </MemoryRouter>
    );

    const takeBtn = screen.getByRole("button", { name: /Взять этот код/i });
    fireEvent.click(takeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Лимит запросов к GitHub исчерпан/i)).toBeTruthy();
      expect(screen.getByText(/через 25 мин/i)).toBeTruthy();
      expect(screen.getByText(/Вход в GitHub увеличивает лимит до 5000/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /Войти в GitHub/i })).toBeTruthy();
    });
  });
});

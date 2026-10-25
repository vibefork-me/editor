/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { useProjectStore } from "../stores/projectStore.ts";
import { OpenPage } from "./OpenPage.tsx";

const mockImportProject = vi.fn();
vi.mock("../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => ({
    importProject: mockImportProject,
  }),
}));

describe("OpenPage unified flow", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useProjectStore.getState().clearForeignChanges();
    mockImportProject.mockReset();
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
    expect(useProjectStore.getState().foreignChanges?.files).toBe(3);
    expect(useProjectStore.getState().foreignChanges?.dependencies).toEqual(["package.json"]);
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
});

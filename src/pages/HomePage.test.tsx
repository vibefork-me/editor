/** @vitest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n/i18nStore.ts";
import { AgentApiError } from "../client/types.ts";
import { resolveProjectParam } from "../hooks/useProjectParam.ts";
import { HomePage } from "./HomePage.tsx";

const mockListProjects = vi.fn();
const mockGetJournal = vi.fn();

vi.mock("../client/react/useAgentClient.ts", () => ({
  useAgentClient: () => client,
}));

const client = { listProjects: mockListProjects, getJournal: mockGetJournal };

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}

/**
 * Renders the page at `url` and lets the check of `?project=` finish. The agent's answers are mocks that
 * resolve at once, so one turn of the event loop settles everything: no polling against a clock.
 */
async function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:projectId" element={<p>project page</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

describe("HomePage ?project=", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    mockListProjects.mockReset();
    mockGetJournal.mockReset();
  });

  it("without the parameter shows the start screen and asks the agent nothing", async () => {
    await renderAt("/");
    expect(screen.getByText("Choose a project")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockListProjects).not.toHaveBeenCalled();
    expect(mockGetJournal).not.toHaveBeenCalled();
  });

  it("opens a project the session may open, without the parameter in the address", async () => {
    mockListProjects.mockResolvedValue([{ projectId: "notes-app" }, { projectId: "other" }]);
    mockGetJournal.mockResolvedValue({ entries: [] });
    await renderAt("/?project=notes-app");
    expect(screen.getByTestId("where").textContent).toBe("/notes-app");
    expect(screen.getByText("project page")).toBeTruthy();
    expect(mockGetJournal).toHaveBeenCalledTimes(1);
    expect(mockGetJournal).toHaveBeenCalledWith("notes-app");
  });

  it("an unknown project: a message, the start screen, the parameter gone", async () => {
    mockListProjects.mockResolvedValue([{ projectId: "other" }]);
    await renderAt("/?project=notes-app&lang=en");
    expect(screen.getByRole("alert")).toHaveProperty("textContent", "The agent has no such project");
    expect(screen.getByText("Choose a project")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/?lang=en");
    // Access is not asked for a project the agent does not have.
    expect(mockGetJournal).not.toHaveBeenCalled();
  });

  it("no access to the project: a message and the start screen", async () => {
    mockListProjects.mockResolvedValue([{ projectId: "notes-app" }]);
    mockGetJournal.mockRejectedValue(new AgentApiError("no access to this project", 403));
    await renderAt("/?project=notes-app");
    expect(screen.getByRole("alert")).toHaveProperty(
      "textContent",
      "No access to the project; allow it in the agent's window",
    );
    expect(screen.getByText("Choose a project")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/");
  });
});

describe("resolveProjectParam", () => {
  beforeEach(() => {
    mockListProjects.mockReset();
    mockGetJournal.mockReset();
  });

  it("does not ask the agent about a name that is not a project name", async () => {
    for (const name of ["", "..", ".hidden", "a/b", "a b", "x".repeat(81)]) {
      expect(await resolveProjectParam(client, name)).toEqual({ stay: "agentErrors.notFound" });
    }
    expect(mockListProjects).not.toHaveBeenCalled();
  });

  it("stays when the projects cannot be listed", async () => {
    mockListProjects.mockRejectedValue(new Error("list projects failed"));
    expect(await resolveProjectParam(client, "notes-app")).toEqual({ stay: "agentErrors.notFound" });
  });

  it("opens the project when the journal fails for another reason; the project page shows it", async () => {
    mockListProjects.mockResolvedValue([{ projectId: "notes-app" }]);
    mockGetJournal.mockRejectedValue(new AgentApiError("read journal failed (500)", 500));
    expect(await resolveProjectParam(client, "notes-app")).toEqual({ open: "notes-app" });
  });
});

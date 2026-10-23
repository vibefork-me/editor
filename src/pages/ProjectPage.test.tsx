/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../stores/projectStore.ts";
import { useI18nStore } from "../i18n/i18nStore.ts";

vi.mock("../hooks/useProjectShellSync.ts", () => ({ useProjectShellSync: () => undefined }));
vi.mock("../components/canvas/index.ts", () => ({ CanvasPanel: () => <div data-testid="canvas" /> }));
vi.mock("../components/viewer/index.ts", () => ({ ViewerLayoutContainer: () => null }));
vi.mock("../components/shell/PhaseRail.tsx", () => ({ PhaseRail: () => null }));
vi.mock("../components/shell/StatusBar.tsx", () => ({ StatusBar: () => null }));

import { ProjectPage } from "./ProjectPage.tsx";

describe("ProjectPage responsive workspace", () => {
  beforeEach(() => {
    useI18nStore.getState().setLocale("en");
    useProjectStore.setState({ currentProjectId: "demo", projectMeta: { projectId: "demo" } });
  });

  it("provides Map and Chat tabs for compact workspaces", () => {
    render(
      <MemoryRouter initialEntries={["/demo"]}>
        <Routes><Route path="/:projectId" element={<ProjectPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Workspace panels" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Map" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("complementary", { name: "Chat" }).className).toContain("flex");
  });
});

// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DoneSummary } from "./DoneSummary.tsx";

describe("DoneSummary", () => {
  it("renders build action by default in MVP mode", () => {
    const handleBuild = vi.fn();
    const handleView = vi.fn();

    render(<DoneSummary onBuild={handleBuild} onViewChanges={handleView} />);

    expect(screen.getByRole("region")).toBeTruthy();
    expect(screen.getByText(/завершена|completed/i)).toBeTruthy();

    const buildBtn = screen.getByRole("button", { name: /собрать|build/i });
    const viewBtn = screen.getByRole("button", { name: /посмотреть изменения|view changes/i });

    expect(buildBtn).toBeTruthy();
    expect(viewBtn).toBeTruthy();

    fireEvent.click(buildBtn);
    expect(handleBuild).toHaveBeenCalledTimes(1);

    fireEvent.click(viewBtn);
    expect(handleView).toHaveBeenCalledTimes(1);
  });

  it("displays built status and allows copying artifact path", () => {
    const handleCopy = vi.fn();

    render(
      <DoneSummary
        buildStatus="built"
        artifactsPath="D:/out/app.exe"
        onCopyArtifacts={handleCopy}
      />
    );

    expect(screen.getByText(/сборка готова|build ready/i)).toBeTruthy();
    expect(screen.getByTitle("D:/out/app.exe")).toBeTruthy();

    const copyBtn = screen.getByRole("button", { name: /копировать путь|copy path/i });
    expect(copyBtn).toBeTruthy();
    fireEvent.click(copyBtn);
    expect(handleCopy).toHaveBeenCalledTimes(1);
  });

  it("disables build button while building", () => {
    render(<DoneSummary buildStatus="building" />);
    const btn = screen.getByRole("button", { name: /сборка|building/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  describe("when GitHub save flag is enabled", () => {
    it("renders save button and actions", () => {
      const handleSave = vi.fn();
      const handleView = vi.fn();

      render(
        <DoneSummary
          showGithubSave={true}
          onSave={handleSave}
          onViewChanges={handleView}
        />
      );

      const saveBtn = screen.getByRole("button", { name: /сохранить|save/i });
      expect(saveBtn).toBeTruthy();

      fireEvent.click(saveBtn);
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    it("disables save until an action is available", () => {
      render(<DoneSummary showGithubSave={true} />);
      expect(
        (screen.getByRole("button", { name: /сохранить|save/i }) as HTMLButtonElement).disabled
      ).toBe(true);
    });
  });
});

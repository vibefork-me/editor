// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DoneSummary } from "./DoneSummary.tsx";

describe("DoneSummary", () => {
  it("renders completion title and actions", () => {
    const handleSave = vi.fn();
    const handleView = vi.fn();

    render(<DoneSummary onSave={handleSave} onViewChanges={handleView} />);

    expect(screen.getByRole("region")).toBeTruthy();
    expect(screen.getByText(/завершена|completed/i)).toBeTruthy();

    const saveBtn = screen.getByRole("button", { name: /сохранить|save/i });
    const viewBtn = screen.getByRole("button", { name: /посмотреть изменения|view changes/i });

    expect(saveBtn).toBeTruthy();
    expect(viewBtn).toBeTruthy();

    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledTimes(1);

    fireEvent.click(viewBtn);
    expect(handleView).toHaveBeenCalledTimes(1);
  });
});

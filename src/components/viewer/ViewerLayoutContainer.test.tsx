// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useViewerStore } from "../../stores/viewerStore.ts";
import { ViewerLayoutContainer } from "./ViewerLayoutContainer.tsx";

describe("ViewerLayoutContainer", () => {
  beforeEach(() => {
    useViewerStore.getState().resetViewer();
  });

  it("does not render when isOpen is false", () => {
    render(<ViewerLayoutContainer />);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("renders file viewer with active path when open", async () => {
    useViewerStore.setState({
      isOpen: true,
      activePath: "src/main.rs",
      mode: "file",
      content: "fn main() { println!(\"hello\"); }",
    });

    render(<ViewerLayoutContainer />);
    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(screen.getByText("src/main.rs")).toBeTruthy();
    expect(screen.getByText(/файл|file/i)).toBeTruthy();
    expect(await screen.findByText(/println!/)).toBeTruthy();
  });

  it("renders diff viewer with diff mode badge", async () => {
    useViewerStore.setState({
      isOpen: true,
      activePath: "crates/vf-core/lib.rs",
      mode: "diff",
      diffOriginal: "const A: u32 = 1;",
      diffModified: "const A: u32 = 2;",
    });

    render(<ViewerLayoutContainer />);
    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(screen.getByText(/дифф|diff/i)).toBeTruthy();
    expect(await screen.findByText(/const A: u32 = 1;/)).toBeTruthy();
    expect(await screen.findByText(/const A: u32 = 2;/)).toBeTruthy();
  });

  it("closes viewer when close button is clicked", () => {
    useViewerStore.setState({
      isOpen: true,
      activePath: "test.ts",
      mode: "file",
    });

    render(<ViewerLayoutContainer />);
    const closeBtn = screen.getByRole("button", { name: /закрыть|close/i });
    fireEvent.click(closeBtn);

    expect(useViewerStore.getState().isOpen).toBe(false);
  });

  it("closes viewer when Escape key is pressed", () => {
    useViewerStore.setState({
      isOpen: true,
      activePath: "test.ts",
      mode: "file",
    });

    render(<ViewerLayoutContainer />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(useViewerStore.getState().isOpen).toBe(false);
  });

  it("renders warning banner when file exceeds 2 MiB limit", () => {
    // Generate a string exceeding 2 MiB (2 * 1024 * 1024 bytes)
    const largeContent = "a".repeat(2 * 1024 * 1024 + 10);
    useViewerStore.setState({
      isOpen: true,
      activePath: "big-data.bin",
      mode: "file",
      content: largeContent,
    });

    render(<ViewerLayoutContainer />);
    expect(screen.getByTestId("too-large-banner")).toBeTruthy();
    expect(screen.getByText(/превышает лимит|exceeds preview limit/i)).toBeTruthy();
  });

  it("renders error banner when error occurs", () => {
    useViewerStore.setState({
      isOpen: true,
      activePath: "missing.rs",
      error: "File not found on disk",
    });

    render(<ViewerLayoutContainer />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("File not found on disk")).toBeTruthy();
  });
});

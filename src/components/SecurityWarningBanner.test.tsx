// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecurityWarningBanner } from "./SecurityWarningBanner.tsx";

describe("SecurityWarningBanner", () => {
  it("renders nothing when extraOrigins is empty or undefined", () => {
    const { container: c1 } = render(<SecurityWarningBanner extraOrigins={[]} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<SecurityWarningBanner />);
    expect(c2.firstChild).toBeNull();
  });

  it("renders warning banner when extraOrigins are present", () => {
    render(<SecurityWarningBanner extraOrigins={["http://localhost:5173", "http://test.local:3000"]} />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Предупреждение безопасности/i)).toBeTruthy();
    expect(screen.getByText("http://localhost:5173")).toBeTruthy();
    expect(screen.getByText("http://test.local:3000")).toBeTruthy();
  });

  it("toggles details on click", () => {
    render(<SecurityWarningBanner extraOrigins={["http://localhost:5173"]} />);

    expect(screen.queryByText(/Режим extraOrigins предназначен только для локальной разработки/i)).toBeNull();

    const toggleBtn = screen.getByText("Подробнее о риске");
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Режим extraOrigins предназначен только для локальной разработки/i)).toBeTruthy();
    expect(screen.getByText("Скрыть подробности")).toBeTruthy();

    fireEvent.click(screen.getByText("Скрыть подробности"));
    expect(screen.queryByText(/Режим extraOrigins предназначен только для локальной разработки/i)).toBeNull();
  });

  it("allows dismissing and reopening banner", () => {
    render(<SecurityWarningBanner extraOrigins={["http://localhost:5173"]} />);

    const closeBtn = screen.getByRole("button", { name: "Скрыть предупреждение" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Разрешены сторонние источники/i)).toBeTruthy();

    const reopenBtn = screen.getByRole("button", { name: "Показать предупреждение" });
    fireEvent.click(reopenBtn);

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecurityWarningBanner } from "./SecurityWarningBanner.tsx";

describe("SecurityWarningBanner", () => {
  it("renders nothing when extra origins are not active", () => {
    const { container: c1 } = render(<SecurityWarningBanner active={false} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<SecurityWarningBanner />);
    expect(c2.firstChild).toBeNull();
  });

  it("renders the warning when extra origins are active, without listing them", () => {
    render(<SecurityWarningBanner active />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Предупреждение безопасности/i)).toBeTruthy();
    expect(screen.getByText(/сборка агента Vibefork для разработки/i)).toBeTruthy();
  });

  it("toggles details on click", () => {
    render(<SecurityWarningBanner active />);

    expect(screen.queryByText(/Релизные сборки игнорируют extraOrigins/i)).toBeNull();

    const toggleBtn = screen.getByText("Подробнее о риске");
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/Релизные сборки игнорируют extraOrigins/i)).toBeTruthy();
    expect(screen.getByText("Скрыть подробности")).toBeTruthy();

    fireEvent.click(screen.getByText("Скрыть подробности"));
    expect(screen.queryByText(/Релизные сборки игнорируют extraOrigins/i)).toBeNull();
  });

  it("allows dismissing and reopening banner", () => {
    render(<SecurityWarningBanner active />);

    const closeBtn = screen.getByRole("button", { name: "Скрыть предупреждение" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Сборка для разработки: разрешены сторонние веб-источники/i)).toBeTruthy();

    const reopenBtn = screen.getByRole("button", { name: "Показать предупреждение" });
    fireEvent.click(reopenBtn);

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

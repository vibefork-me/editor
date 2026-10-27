// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { FeedLineView } from "./FeedLineView.tsx";

describe("FeedLineView", () => {
  beforeEach(() => useI18nStore.getState().setLocale("ru"));

  it("shows the readable phrase and keeps the raw line under Details", () => {
    const { container } = render(
      <FeedLineView line={{ kind: "status", text: "1/3 done", key: "feed.stepDone", params: { n: 1, of: 3 } }} />,
    );
    expect(screen.getByText("Шаг 1 из 3 готов")).toBeTruthy();
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.textContent).toBe("Подробнее");
    expect(details.querySelector("code")!.textContent).toBe("1/3 done");
  });

  it("follows the interface language", () => {
    useI18nStore.getState().setLocale("en");
    render(<FeedLineView line={{ kind: "error", text: "exit 2", key: "feed.exitCode", params: { code: 2 } }} />);
    expect(screen.getByText("The task ended with an error (code 2)")).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
  });

  it("shows a line without a phrase as is, without Details", () => {
    const { container } = render(<FeedLineView line={{ kind: "agent", text: "Fixed the import" }} />);
    expect(screen.getByText("Fixed the import")).toBeTruthy();
    expect(container.querySelector("details")).toBeNull();
  });
});

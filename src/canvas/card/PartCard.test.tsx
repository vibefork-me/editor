// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { buildCanvasState, canvasNodes } from "../canvasState.ts";
import { after, stream } from "../testSessions.ts";
import { PartCallout, PartPanel, sinceStart } from "./PartCard.tsx";
import { changesOf, partBadges, partHistory, relatedGroups, relatedParts } from "./partInfo.ts";

const at = (n: number) => buildCanvasState(stream, after(n));
const node = (n: number, id: string) => canvasNodes(at(n)).find((x) => x.id === id)!;

describe("what the card knows about a part", () => {
  it("lists its states", () => {
    // The agent has been looking at the editor screen since event 11.
    expect(partBadges(node(34, "ui")).map((b) => b.key)).toEqual(["canvas.badgeAgentHere", "canvas.badgeFailed", "canvas.badgeChanged", "canvas.badgeTask"]);
    expect(partBadges(node(20, "fork")).map((b) => b.key)).toEqual(["canvas.badgeOtherVersion"]);
  });

  it("finds the parts next to it: parent, children, and those the agent linked it with", () => {
    expect(relatedParts(at(16), "store").map((n) => n.id)).toEqual(["root", "sync", "ui"]);
    const groups = relatedGroups(at(16), "store");
    expect(groups.parent?.id).toBe("root");
    expect(groups.children.map((n) => n.id)).toEqual(["sync"]);
    expect(groups.linked.map((n) => n.id)).toEqual(["ui"]);
  });

  it("tells what happened to it in the session, once per link and per insight", () => {
    useI18nStore.getState().setLocale("en");
    const { t } = useI18nStore.getState();
    const history = partHistory(stream.filter((r) => r.at <= after(39)), "ui", t, (id) => ({ store: "Note storage" })[id] ?? id);
    expect(history.map((h) => h.kind)).toEqual(["found", "think", "insight", "link", "change", "failed", "change"]);
    expect(history.map((h) => h.text)).toContain("Linked it with “Note storage”");
    expect(history.map((h) => h.text)).toContain("Thought: What does the editor screen do?");
    expect(history.map((h) => h.text)).toContain("“Notes are written in Markdown”");
  });

  it("counts the time from the start of the session", () => {
    expect(sinceStart(7_400)).toBe("00:07");
    expect(sinceStart(754_000)).toBe("12:34");
    expect(sinceStart(3_723_000)).toBe("1:02:03");
  });

  it("finds the files a task changed in it", () => {
    expect(changesOf(at(38), "ui")).toBeNull();
    expect(changesOf(at(39), "ui")?.files.map((f) => f.path)).toEqual(["src/ui/theme.ts"]);
    expect(changesOf(at(39), "store")).toBeNull();
  });
});

describe("part card", () => {
  beforeEach(() => useI18nStore.getState().setLocale("en"));

  const actions = () => ({
    onAsk: vi.fn(),
    onShowChanges: vi.fn(),
    onOpenFile: vi.fn(),
    onGoTo: vi.fn(),
    onClose: vi.fn(),
  });

  it("next to the node: states, insight, ask, changes, linked parts, more", () => {
    const a = actions();
    const onMore = vi.fn();
    render(<PartCallout state={at(39)} nodeId="ui" api={null} onMore={onMore} {...a} />);
    expect(screen.getByText("Editor screen")).toBeTruthy();
    expect(screen.getByText("changed")).toBeTruthy();
    expect(screen.getByText(/Notes are written in Markdown/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ask the agent about this" }));
    expect(a.onAsk).toHaveBeenCalledWith("About “Editor screen”: ");
    fireEvent.click(screen.getByRole("button", { name: "Show the changes" }));
    expect(a.onShowChanges).toHaveBeenCalledWith(expect.objectContaining({ path: "src/ui/theme.ts" }));
    fireEvent.click(screen.getByRole("button", { name: "Note storage" }));
    expect(a.onGoTo).toHaveBeenCalledWith("store");
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    expect(onMore).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(a.onClose).toHaveBeenCalled();
  });

  it("in the panel: everything about the part, files for developers open in the code viewer", () => {
    const a = actions();
    render(<PartPanel state={at(39)} nodeId="ui" records={stream.filter((r) => r.at <= after(39))} {...a} />);
    expect(screen.getByText("What the agent understood")).toBeTruthy();
    expect(screen.getByText("belongs to")).toBeTruthy();
    expect(screen.getByText("the agent linked it with")).toBeTruthy();
    expect(screen.getByTestId("part-history").textContent).toContain("00:07Found this part");
    expect(screen.getByText("What happened to this part")).toBeTruthy();
    expect(screen.getByTestId("part-history").textContent).toContain("A check failed here");
    fireEvent.click(screen.getByRole("button", { name: "Note storage" }));
    expect(a.onGoTo).toHaveBeenCalledWith("store");
    fireEvent.click(screen.getByText("For developers"));
    fireEvent.click(screen.getByRole("button", { name: "src/ui/editor.tsx" }));
    expect(a.onOpenFile).toHaveBeenCalledWith("src/ui/editor.tsx");
  });

  it("explains the part in words only when offered, waiting while an explanation is under way", () => {
    const onExplain = vi.fn();
    const { rerender } = render(<PartCallout state={at(39)} nodeId="ui" api={null} onMore={() => {}} {...actions()} />);
    expect(screen.queryByRole("button", { name: "Explain this part" })).toBeNull();
    rerender(<PartCallout state={at(39)} nodeId="ui" api={null} onMore={() => {}} {...actions()} onExplain={onExplain} />);
    const button = screen.getByRole("button", { name: "Explain this part" }) as HTMLButtonElement;
    expect(button.title).toBe("Get an answer in words; nothing in the project changes");
    fireEvent.click(button);
    expect(onExplain).toHaveBeenCalledWith("ui");
    rerender(<PartPanel state={at(39)} nodeId="ui" {...actions()} onExplain={onExplain} explaining />);
    expect((screen.getByRole("button", { name: "Explain this part" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows nothing for a part that is not on the canvas", () => {
    const { container } = render(<PartPanel state={at(5)} nodeId="ui" {...actions()} />);
    expect(container.firstChild).toBeNull();
  });

  it("puts the part back as it was only when offered, with how the last try went", () => {
    const onUndo = vi.fn();
    const { rerender } = render(<PartPanel state={at(39)} nodeId="ui" {...actions()} />);
    expect(screen.queryByRole("button", { name: "Put it back as it was" })).toBeNull();
    rerender(<PartPanel state={at(39)} nodeId="ui" undo={{ status: null, onUndo }} {...actions()} />);
    fireEvent.click(screen.getByRole("button", { name: "Put it back as it was" }));
    expect(onUndo).toHaveBeenCalled();
    rerender(<PartPanel state={at(39)} nodeId="ui" undo={{ status: { state: "failed", reason: "card.rollbackNotSupported" }, onUndo }} {...actions()} />);
    expect(screen.getByRole("status").textContent).toBe("This version of the agent cannot do this; update the agent");
    rerender(<PartCallout state={at(39)} nodeId="ui" api={null} onMore={() => {}} undo={{ status: { state: "confirm" }, onUndo }} {...actions()} />);
    expect(screen.getByRole("status").textContent).toBe("Allow it in the agent's window");
    expect((screen.getByRole("button", { name: "Put it back as it was" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

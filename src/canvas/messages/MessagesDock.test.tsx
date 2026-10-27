// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteAttachment, Offer } from "../../client/protocol.generated.ts";
import { useI18nStore } from "../../i18n/i18nStore.ts";
import { buildCanvasState, type CanvasState } from "../canvasState.ts";
import { after, stream } from "../testSessions.ts";
import { MessagesDock } from "./MessagesDock.tsx";
import type { PersonMessage } from "./messages.ts";

const at = (n: number) => buildCanvasState(stream, after(n));

function Dock({
  state,
  running = false,
  messages = [],
  onSend = () => {},
  onGoTo,
  onChooseOffer,
}: {
  state: CanvasState;
  running?: boolean;
  messages?: PersonMessage[];
  onSend?: (text: string, attachments: NoteAttachment[]) => void;
  onGoTo?: (id: string) => void;
  onChooseOffer?: (index: number, offer: Offer) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <MessagesDock
      state={state}
      running={running}
      messages={messages}
      draft={draft}
      onDraftChange={setDraft}
      onSend={(text, attachments) => {
        onSend(text, attachments);
        setDraft("");
      }}
      onGoTo={onGoTo}
      onChooseOffer={onChooseOffer}
    />
  );
}

const field = () => screen.getByRole("textbox", { name: "Message the agent" }) as HTMLTextAreaElement;

describe("messages dock", () => {
  beforeEach(() => useI18nStore.getState().setLocale("en"));

  it("sends on Enter, keeps a new line on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<Dock state={at(30)} running onSend={onSend} />);
    expect(field().placeholder).toBe("Tell the agent — it reads it after the current step");
    fireEvent.change(field(), { target: { value: "Keep the toggle" } });
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Keep the toggle", []);
    expect(field().value).toBe("");
  });

  it("offers what can be done; a click puts its text into the field", () => {
    render(<Dock state={at(22)} />);
    expect(screen.getByText("What you can do")).toBeTruthy();
    expect(screen.getByText("Asked for in 4 issues")).toBeTruthy();
    fireEvent.click(screen.getByText("Dark theme"));
    expect(field().value).toBe("Add a dark look");
  });

  it("starts the task of an offer when it can, leaving the field as it is", () => {
    const onChooseOffer = vi.fn();
    render(<Dock state={at(22)} onChooseOffer={onChooseOffer} />);
    fireEvent.click(screen.getByText("Export to PDF"));
    expect(onChooseOffer).toHaveBeenCalledWith(1, expect.objectContaining({ title: "Export to PDF", text: "Save a note as a PDF" }));
    expect(field().value).toBe("");
  });

  it("hides the offers while a task runs and asks what to do next after it", () => {
    const { rerender } = render(<Dock state={at(30)} running />);
    expect(screen.queryByText("What you can do")).toBeNull();
    rerender(<Dock state={at(39)} />);
    expect(screen.getAllByText("What to do next?").length).toBeGreaterThan(0);
  });

  it("shows a note waiting, then taken with the agent's answer and its parts", () => {
    const onGoTo = vi.fn();
    const messages: PersonMessage[] = [{ id: "a", text: "Put the switch in the settings", attachments: [], at: after(30), kind: "note", takenBefore: 0 }];
    const { rerender } = render(<Dock state={at(36)} running messages={messages} onGoTo={onGoTo} />);
    expect(screen.getByTestId("person-message").textContent).toContain("with the agent · will read it after the step");
    rerender(<Dock state={at(37)} running messages={messages} onGoTo={onGoTo} />);
    expect(screen.getByTestId("person-message").dataset.status).toBe("taken");
    expect(screen.getByTestId("agent-reply").textContent).toContain("Kept the toggle in the settings");
    fireEvent.click(screen.getByText("Editor screen"));
    expect(onGoTo).toHaveBeenCalledWith("ui");
    // The place is called "Message the agent", like the field.
    expect(screen.getByRole("region", { name: "Message the agent" })).toBeTruthy();
    // The conversation folds.
    fireEvent.click(screen.getByText("Hide the conversation"));
    expect(screen.queryByTestId("conversation")).toBeNull();
    expect(screen.getByText("Show the conversation (2)")).toBeTruthy();
  });

  it("says plainly when the agent did not take a note", () => {
    const messages: PersonMessage[] = [{ id: "a", text: "x", attachments: [], at: 1, kind: "note", takenBefore: 0, failed: true }];
    render(<Dock state={at(30)} running messages={messages} />);
    expect(screen.getByTestId("person-message").textContent).toContain("not delivered");
  });

  it("attaches long pasted text instead of putting it into the field", () => {
    const onSend = vi.fn();
    render(<Dock state={at(30)} running onSend={onSend} />);
    const long = "a".repeat(2500);
    fireEvent.paste(field(), { clipboardData: { files: [], getData: () => long } });
    expect(field().value).toBe("");
    expect(screen.getByLabelText("Remove pasted-text.txt")).toBeTruthy();
    fireEvent.click(screen.getByText("Send"));
    expect(onSend).toHaveBeenCalledWith("", [expect.objectContaining({ name: "pasted-text.txt", mime: "text/plain" })]);
  });

  it("attaches a picture from the clip and refuses one that is too large", async () => {
    const onSend = vi.fn();
    render(<Dock state={at(30)} running onSend={onSend} />);
    const input = screen.getByTestId("attach-input");
    const small = new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
    const big = new File([new Uint8Array(1)], "huge.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [small, big] } });
    await waitFor(() => expect(screen.getByLabelText("Remove shot.png")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toBe("huge.png is too large (up to 5 MB)");
    fireEvent.change(field(), { target: { value: "Like this" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Like this", [{ name: "shot.png", mime: "image/png", data: "AQID" }]);
  });

  it("is called «Сообщение агенту» in Russian", () => {
    useI18nStore.getState().setLocale("ru");
    render(<Dock state={at(30)} running />);
    expect(screen.getByRole("textbox", { name: "Сообщение агенту" })).toBeTruthy();
  });
});

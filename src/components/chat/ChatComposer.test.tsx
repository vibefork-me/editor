// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./ChatComposer.tsx";

describe("ChatComposer", () => {
  it("keeps the supplied draft and submits through its callback", () => {
    const onSend = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <ChatComposer
        value="[Graph] "
        onChange={onChange}
        onSend={onSend}
        isSending={false}
      />
    );
    const input = screen.getByRole("textbox", { name: /сообщение агенту|message the agent/i });

    expect((input as HTMLTextAreaElement).value).toBe("[Graph] ");
    fireEvent.change(input, { target: { value: "[Graph] Explain this" } });
    expect(onChange).toHaveBeenCalledWith("[Graph] Explain this");
    fireEvent.submit(container.querySelector("form")!);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

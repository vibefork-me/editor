import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import type { NoteAttachment } from "../../client/protocol.generated.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { CanvasState } from "../canvasState.ts";
import {
  LONG_TEXT,
  MAX_ATTACHMENTS,
  conversation,
  isImage,
  overLimit,
  readAttachment,
  textAttachment,
  waitingCount,
  type ConversationItem,
  type PersonMessage,
} from "./messages.ts";

// The field grows with its text up to this height, then scrolls.
const MAX_FIELD_PX = 200;

export interface MessagesDockProps {
  state: CanvasState;
  /** A task runs: what is sent goes to it as a note; otherwise it starts a new task. */
  running: boolean;
  messages: PersonMessage[];
  draft: string;
  onDraftChange: (text: string) => void;
  /** Sends the draft with its attachments; the dock clears them. */
  onSend: (text: string, attachments: NoteAttachment[]) => void;
  /** Moves to a part named in an answer of the agent. */
  onGoTo?: (id: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Shown above everything else (e.g. the banner of a paused task). */
  children?: ReactNode;
}

/**
 * Bottom center of the canvas: what can be done (offers of the agent), the conversation with the agent
 * (folds), and the field to write to it.
 */
export function MessagesDock({ state, running, messages, draft, onDraftChange, onSend, onGoTo, inputRef, children }: MessagesDockProps) {
  const { t } = useTranslation();
  const items = conversation(messages, state.notesTaken);
  const waiting = waitingCount(items);
  const [open, setOpen] = useState(true);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A new note while folded opens the conversation: its status is what the person waits for.
  useEffect(() => {
    if (waiting > 0) setOpen(true);
  }, [waiting]);

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD_PX)}px`;
  }, [draft]);

  const setField = (el: HTMLTextAreaElement | null) => {
    fieldRef.current = el;
    if (typeof inputRef === "function") inputRef(el);
    else if (inputRef) (inputRef as { current: HTMLTextAreaElement | null }).current = el;
  };

  const add = (more: NoteAttachment[]) => {
    setAttachments((now) => {
      const all = [...now, ...more];
      if (all.length > MAX_ATTACHMENTS) setProblem(t("messages.tooMany", { count: MAX_ATTACHMENTS }));
      return all.slice(0, MAX_ATTACHMENTS);
    });
  };

  const addFiles = async (files: File[]) => {
    setProblem(null);
    const ok: File[] = [];
    for (const f of files) {
      const limit = overLimit(f);
      if (limit) setProblem(t("messages.tooLarge", { name: f.name || "file", limit: limit / (1024 * 1024) }));
      else ok.push(f);
    }
    const read = await Promise.all(ok.map((f) => readAttachment(f).catch(() => null)));
    add(read.filter((a): a is NoteAttachment => a !== null));
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
      return;
    }
    const text = e.clipboardData.getData("text/plain");
    if (text.length > LONG_TEXT) {
      e.preventDefault();
      add([textAttachment(text, t("messages.pastedText"))]);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    if (!running && attachments.some(isImage)) setProblem(t("messages.imagesNeedTask"));
    else setProblem(null);
    onSend(text, attachments);
    setAttachments([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const placeholder = running ? t("messages.placeholderRunning") : state.result ? t("messages.placeholderNext") : t("messages.placeholderTask");
  const offers = running ? [] : state.offers;

  return (
    <div className="pointer-events-auto flex w-full max-w-[640px] flex-col gap-2" data-testid="messages-dock">
      {children}
      {offers.length > 0 && (
        <section aria-label={state.result ? t("messages.offersNext") : t("messages.offersTitle")} className="rounded-xl border border-[#30363d] bg-[rgba(22,27,34,0.95)] p-2">
          <div className="px-1 pb-1 text-[12px] font-semibold text-[#8b93a7]">{state.result ? t("messages.offersNext") : t("messages.offersTitle")}</div>
          <div className="flex flex-wrap gap-1.5">
            {offers.map((o) => (
              <button
                key={o.title}
                type="button"
                onClick={() => {
                  onDraftChange(o.text);
                  fieldRef.current?.focus();
                }}
                className="flex max-w-[200px] flex-col items-start rounded-lg border border-[#30363d] bg-[#1b1f28] px-2.5 py-1.5 text-left hover:border-[#58a6ff]"
              >
                <span className="text-[13px] font-semibold text-[#f4f5f8]">{o.title}</span>
                {o.source && <span className="text-[11px] text-[#8b93a7]">{o.source.text}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
      {items.length > 0 && (
        <section aria-label={t("messages.title")} className="rounded-xl border border-[#30363d] bg-[rgba(22,27,34,0.95)]">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-[12px] font-semibold text-[#8b93a7]"
          >
            <span>{t("messages.title")}</span>
            <span>{open ? t("messages.hideConversation") : t("messages.showConversation", { count: items.length })}</span>
          </button>
          {open && (
            <ol className="max-h-[220px] space-y-1.5 overflow-y-auto px-3 pb-2" aria-live="polite" data-testid="conversation">
              {items.map((item) => (
                <ConversationLine key={item.id} item={item} state={state} onGoTo={onGoTo} />
              ))}
            </ol>
          )}
        </section>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex flex-col gap-1.5 rounded-xl border border-[#30363d] bg-[rgba(22,27,34,0.97)] p-2 shadow-2xl"
      >
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("messages.attach")}>
            {attachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center gap-1 rounded-md border border-[#30363d] bg-[#1b1f28] px-2 py-0.5 text-[12px] text-[#c9d1d9]">
                <IconClip />
                {a.name}
                <button
                  type="button"
                  aria-label={t("messages.removeAttachment", { name: a.name })}
                  onClick={() => setAttachments((now) => now.filter((_, j) => j !== i))}
                  className="ml-1 text-[#8b93a7]"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-label={t("messages.attach")}
            title={t("messages.attach")}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#30363d] bg-[#1b1f28] text-[#8b93a7]"
          >
            <IconClip />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,text/*,.md,.json,.log"
            className="hidden"
            data-testid="attach-input"
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <textarea
            ref={setField}
            aria-label={t("messages.inputLabel")}
            rows={1}
            maxLength={8000}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className="block max-h-[200px] min-h-9 w-full resize-none rounded-lg bg-transparent px-2 py-2 text-sm text-[#f4f5f8] placeholder:text-[#6e7681] focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() && attachments.length === 0}
            className="h-9 shrink-0 rounded-lg bg-accent px-3 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("messages.send")}
          </button>
        </div>
        {problem && (
          <p role="status" className="px-1 text-[12px] text-[#f0b72f]">
            {problem}
          </p>
        )}
      </form>
    </div>
  );
}

function ConversationLine({ item, state, onGoTo }: { item: ConversationItem; state: CanvasState; onGoTo?: (id: string) => void }) {
  const { t } = useTranslation();
  if (item.who === "agent") {
    return (
      <li className="text-[13px] text-[#c9d1d9]" data-testid="agent-reply">
        <span className="font-semibold text-[#79c0ff]">{t("messages.agent")}: </span>
        {item.text}
        {item.related.map((id) => (
          <button key={id} type="button" onClick={() => onGoTo?.(id)} className="ml-1.5 rounded border border-[#30363d] px-1.5 text-[12px] text-[#58a6ff] hover:border-[#58a6ff]">
            {state.nodes[id]?.label ?? id}
          </button>
        ))}
      </li>
    );
  }
  const status = {
    task: t("messages.statusTask"),
    waiting: t("messages.statusWaiting"),
    taken: t("messages.statusTaken"),
    failed: t("messages.statusFailed"),
  }[item.status];
  const color = item.status === "failed" ? "text-[#f85149]" : item.status === "taken" ? "text-[#3fb950]" : "text-[#8b93a7]";
  return (
    <li className="text-[13px] text-[#f4f5f8]" data-testid="person-message" data-status={item.status}>
      <div className="whitespace-pre-wrap break-words">{item.text}</div>
      {item.attachments.length > 0 && <div className="flex items-center gap-1 text-[11px] text-[#8b93a7]"><IconClip />{item.attachments.join(", ")}</div>}
      <div className={`text-[11px] ${color}`}>{status}</div>
    </li>
  );
}

function IconClip() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 4.5 5.4 9.6a1.5 1.5 0 0 0 2.1 2.1l5.3-5.3a3 3 0 0 0-4.2-4.2L3.3 7.5a4.5 4.5 0 0 0 6.4 6.4l4.1-4.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

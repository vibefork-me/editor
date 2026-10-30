import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import type { NoteAttachment, Offer, OfferSourceKind, Stage } from "../../client/protocol.generated.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import type { CanvasState } from "../canvasState.ts";
import {
  LONG_TEXT,
  MAX_ATTACHMENTS,
  conversation,
  isImage,
  overLimit,
  promptWithText,
  readAttachment,
  textAttachment,
  waitingCount,
  type ConversationItem,
  type PersonMessage,
} from "./messages.ts";

// The field grows with its text up to this height, then scrolls.
const MAX_FIELD_PX = 200;

// What people typically tell the agent at a stage of a task: one click sends it.
const HINTS: Partial<Record<Stage, TranslationKey[]>> = {
  understand: ["messages.hintCopyFirst", "messages.hintSimpler"],
  plan: ["messages.hintCopyFirst", "messages.hintSimpler"],
  change: ["messages.hintKeepLook", "messages.hintShowChanges"],
  check: ["messages.hintCheckAgain", "messages.hintShowReport"],
};

export interface MessagesDockProps {
  state: CanvasState;
  /** A task runs: what is sent goes to it as a note; otherwise it starts a new task. */
  running: boolean;
  messages: PersonMessage[];
  draft: string;
  onDraftChange: (text: string) => void;
  /** Sends the draft with its attachments; the dock clears them. */
  onSend: (text: string, attachments: NoteAttachment[]) => void;
  /** Starts the task of an offer (`index` in the shown offers); without it a click puts the offer's
   * text into the field. */
  onChooseOffer?: (index: number, offer: Offer) => void;
  /** Moves to a part named in an answer of the agent. */
  onGoTo?: (id: string) => void;
  /** Has the agent answer the text in words, changing nothing; absent while a task runs. */
  onExplain?: (text: string) => void;
  /** An explanation is under way: the button waits. */
  explaining?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
  /** Shown above everything else (e.g. the banner of a paused task). */
  children?: ReactNode;
}

/**
 * Bottom center of the canvas: what can be done (offers of the agent), the conversation with the agent
 * (folds), and the field to write to it.
 */
export function MessagesDock({
  state,
  running,
  messages,
  draft,
  onDraftChange,
  onSend,
  onChooseOffer,
  onGoTo,
  onExplain,
  explaining,
  inputRef,
  children,
}: MessagesDockProps) {
  const { t } = useTranslation();
  const items = conversation(messages, state.notesTaken, state.explanations);
  const waiting = waitingCount(items);
  const answering = items.some((i) => i.who === "person" && i.status === "explaining");
  const [open, setOpen] = useState(true);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A new note while folded opens the conversation: its status is what the person waits for.
  useEffect(() => {
    if (waiting > 0 || answering || explaining) setOpen(true);
  }, [waiting, answering, explaining]);

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

  // A question answered in words: pictures cannot go with it, pasted text goes into it.
  const explain = () => {
    const text = draft.trim();
    if (!onExplain || (!text && attachments.length === 0)) return;
    setProblem(attachments.some(isImage) ? t("messages.imagesNeedTask") : null);
    onExplain(promptWithText(text, attachments));
    setAttachments([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  // A task of the stream is under way (maybe from another tab): its offers wait for its end.
  const offers = running || (state.task && !state.result) ? [] : state.offers;
  const placeholder = running
    ? t("messages.placeholderRunning")
    : state.result
      ? t("messages.placeholderNext")
      : offers.length > 0
        ? t("messages.placeholderOffers")
        : t("messages.placeholderTask");
  const hints = running && draft === "" && attachments.length === 0 && state.stage ? (HINTS[state.stage] ?? []) : [];

  return (
    <div className="pointer-events-auto flex w-full max-w-[640px] flex-col gap-2" data-testid="messages-dock">
      {children}
      {offers.length > 0 && (
        <section
          aria-label={state.result ? t("messages.offersNext") : t("messages.offersTitle")}
          className="flex animate-slide-up flex-col gap-2 rounded-[14px] border border-[#30363d] bg-[rgba(20,22,29,0.96)] p-2.5"
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-[#8b93a7]">
            <IconSparkles />
            {state.result ? t("messages.offersNext") : t("messages.offersTitle")}
          </div>
          {/* After a result the offers are what else can be done: short, under its screen. */}
          <div className={state.result ? "flex flex-wrap gap-1.5" : "grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2"}>
            {offers.map((o, i) => (
              <button
                key={o.title}
                type="button"
                onClick={() => {
                  // No task runs (the offers are hidden while one does): the offer starts one.
                  if (onChooseOffer && !running) {
                    onChooseOffer(i, o);
                    return;
                  }
                  onDraftChange(o.text);
                  fieldRef.current?.focus();
                }}
                title={state.result ? o.text : undefined}
                className={
                  state.result
                    ? "rounded-full border border-[#30363d] bg-[#1b1f28] px-2.5 py-[3px] text-[11.5px] text-[#c9d1d9] hover:border-[#58a6ff]"
                    : "flex flex-col items-start gap-1 rounded-[10px] border border-[#30363d] bg-[#1b1f28] px-[11px] py-2.5 text-left hover:border-[#58a6ff]"
                }
              >
                {state.result ? (
                  o.title
                ) : (
                  <>
                    <span className="text-[13px] font-semibold text-[#e6edf3]">{o.title}</span>
                    {o.text && <span className="flex-1 text-[11.5px] leading-[1.4] text-[#8b93a7]">{o.text}</span>}
                    {o.source && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-[#79c0ff]">
                        <SourceIcon kind={o.source.kind} />
                        {o.source.text}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
      {items.length > 0 && (
        <section aria-label={t("messages.title")} className="rounded-xl border border-[#262b36] bg-[rgba(20,22,29,0.94)] backdrop-blur-[10px]">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between px-2.5 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.5px] text-[#8b93a7]"
          >
            <span>{t("messages.title")}</span>
            <span>{open ? t("messages.hideConversation") : t("messages.showConversation", { count: items.length })}</span>
          </button>
          {open && (
            <ol className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto px-2.5 pb-2.5" aria-live="polite" data-testid="conversation">
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
        className="flex flex-col gap-1.5 rounded-[14px] border border-[#30363d] bg-[rgba(20,22,29,0.96)] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        {hints.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="hints">
            {hints.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onSend(t(key), [])}
                className="rounded-full border border-[#30363d] bg-[#1b1f28] px-2.5 py-[3px] text-[11.5px] text-[#c9d1d9] hover:border-[#58a6ff]"
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}
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
        <div className="flex items-end gap-1.5">
          <button
            type="button"
            aria-label={t("messages.attach")}
            title={t("messages.attach")}
            onClick={() => fileRef.current?.click()}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-[#8b93a7] hover:bg-[#1b1f28] hover:text-[#c9d1d9]"
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
            className="block max-h-[200px] min-h-[34px] w-full min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[13.5px] leading-[1.4] text-[#e6edf3] placeholder:text-[#6e7681] focus-visible:outline-none"
          />
          {onExplain && !running && (
            <button
              type="button"
              onClick={explain}
              title={t("messages.explainHint")}
              disabled={explaining || (!draft.trim() && attachments.length === 0)}
              className="h-[34px] shrink-0 rounded-[9px] border border-[#30363d] bg-[#1b1f28] px-2.5 text-[12.5px] font-semibold text-[#c9d1d9] hover:border-[#58a6ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("messages.explain")}
            </button>
          )}
          <button
            type="submit"
            aria-label={t("messages.send")}
            title={t("messages.send")}
            disabled={!draft.trim() && attachments.length === 0}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#388bfd] text-white hover:bg-[#58a6ff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconSend />
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
      <li
        className="max-w-[85%] self-start whitespace-pre-wrap break-words rounded-[10px_10px_10px_2px] border border-[#30363d] bg-[#1b1f28] px-2.5 py-[7px] text-[12.5px] leading-[1.6] text-[#c9d1d9]"
        data-testid="agent-reply"
      >
        <span className="sr-only">{t("messages.agent")}: </span>
        {item.reason ? <span className="text-[#e3b341]">{t(item.reason)}</span> : item.text}
        {item.related.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onGoTo?.(id)}
            className="mx-0.5 rounded-full border border-[rgba(247,120,186,0.5)] bg-[rgba(247,120,186,0.1)] px-[7px] text-[11.5px] text-[#f4b6d6] hover:border-[#f778ba]"
          >
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
    explaining: t("messages.statusExplaining"),
    explained: t("messages.statusExplained"),
    unanswered: "",
  }[item.status];
  const color = item.status === "failed" ? "text-[#f85149]" : item.status === "taken" ? "text-[#8fd19e]" : "text-[#f4b6d6]";
  const waiting = item.status === "waiting";
  return (
    <li
      className={`flex max-w-[80%] flex-col gap-1 self-end rounded-[10px_10px_2px_10px] border bg-[rgba(247,120,186,0.16)] px-2.5 py-[7px] text-[12.5px] leading-[1.4] text-[#e6edf3] ${
        waiting ? "border-dashed border-[rgba(247,120,186,0.7)]" : "border-[rgba(247,120,186,0.35)]"
      }`}
      data-testid="person-message"
      data-status={item.status}
    >
      {item.text && <div className="whitespace-pre-wrap break-words">{item.text}</div>}
      {item.attachments.length > 0 && <div className="flex items-center gap-1 text-[11.5px] text-[#c9d1d9]"><IconClip />{item.attachments.join(", ")}</div>}
      {status && (
        <div className={`flex items-center gap-[5px] text-[10.5px] ${color}`}>
          {waiting && <span className="inline-block h-[9px] w-[14px] rounded-[5px] bg-[#f778ba]" />}
          {status}
        </div>
      )}
    </li>
  );
}

const svg = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function IconSparkles() {
  return (
    <svg {...svg}>
      <path d="M9.9 15.5a2 2 0 0 0-1.4-1.4l-6.1-1.6a.5.5 0 0 1 0-1l6.1-1.6a2 2 0 0 0 1.4-1.4l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg {...svg} width={15} height={15}>
      <path d="M3.7 3.7a.5.5 0 0 1 .7-.6l17 8.4a.5.5 0 0 1 0 1l-17 8.4a.5.5 0 0 1-.7-.6L6 12z" />
      <path d="M6 12h16" />
    </svg>
  );
}

/** Where an offer comes from: found in the code, what people do with similar projects, the issues. */
function SourceIcon({ kind }: { kind: OfferSourceKind }) {
  return (
    <svg {...svg} width={11} height={11}>
      {kind === "analysis" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      )}
      {kind === "similar" && (
        <>
          <circle cx="9" cy="8" r="4" />
          <path d="M2 21v-1a6 6 0 0 1 12 0v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.7" />
        </>
      )}
      {kind === "issues" && <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2zM18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />}
    </svg>
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

import type { NoteAttachment } from "../../client/protocol.generated.ts";
import type { CanvasState } from "../canvasState.ts";

/** Text longer than this, pasted into the field, goes as an attachment. */
export const LONG_TEXT = 2000;
/** At most this many attachments per message. */
export const MAX_ATTACHMENTS = 4;
/** Size limits of one attachment, bytes. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_BYTES = 1024 * 1024;

/** A message of the person on the canvas. */
export interface PersonMessage {
  id: string;
  text: string;
  /** Names of what was attached. */
  attachments: string[];
  /** Unix ms. */
  at: number;
  /** `task`: it started a task; `note`: it went to the agent during one. */
  kind: "task" | "note";
  /** How many notes the agent had taken when this one was sent: its answer is a later one. */
  takenBefore: number;
  /** The agent did not take it (an agent without notes answers `not_supported`). */
  failed?: boolean;
}

export type MessageStatus = "task" | "waiting" | "taken" | "failed";

/** One line of the conversation above the field. */
export type ConversationItem =
  | { who: "person"; id: string; text: string; attachments: string[]; status: MessageStatus; at: number }
  | { who: "agent"; id: string; text: string; related: string[]; at: number };

/**
 * The person's messages with the agent's answers. Notes are taken in the order they were sent, so each one
 * gets the first `note.taken` after the ones the agent had already taken when it was sent. Answers to
 * notes of earlier visits stand on their own.
 */
export function conversation(messages: PersonMessage[], notesTaken: CanvasState["notesTaken"]): ConversationItem[] {
  const claimed = new Set<number>();
  const items: ConversationItem[] = [];
  for (const m of messages) {
    let status: MessageStatus = m.kind === "task" ? "task" : m.failed ? "failed" : "waiting";
    let answer: ConversationItem | null = null;
    if (status === "waiting") {
      const i = notesTaken.findIndex((_n, idx) => idx >= m.takenBefore && !claimed.has(idx));
      const taken = notesTaken[i];
      if (taken) {
        claimed.add(i);
        status = "taken";
        if (taken.reply) answer = { who: "agent", id: `reply-${taken.noteId}`, text: taken.reply, related: taken.related, at: Math.max(taken.at, m.at) };
      }
    }
    items.push({ who: "person", id: m.id, text: m.text, attachments: m.attachments, status, at: m.at });
    if (answer) items.push(answer);
  }
  notesTaken.forEach((n, i) => {
    if (!claimed.has(i) && n.reply) items.push({ who: "agent", id: `reply-${n.noteId}`, text: n.reply, related: n.related, at: n.at });
  });
  return items.sort((a, b) => a.at - b.at);
}

/** The newest note the agent has not answered marked as not delivered. */
export function markNotDelivered(messages: PersonMessage[]): PersonMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.kind === "note" && !m.failed) return messages.map((x, j) => (j === i ? { ...x, failed: true } : x));
  }
  return messages;
}

/** Notes sent and not yet taken or refused. */
export function waitingCount(items: ConversationItem[]): number {
  return items.filter((i) => i.who === "person" && i.status === "waiting").length;
}

/** UTF-8 text as base64. */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Bytes an attachment's base64 data stands for. */
export function attachmentBytes(a: NoteAttachment): number {
  const pad = a.data.endsWith("==") ? 2 : a.data.endsWith("=") ? 1 : 0;
  return Math.floor((a.data.length * 3) / 4) - pad;
}

export function isImage(a: { mime: string }): boolean {
  return a.mime.startsWith("image/");
}

/** Long pasted text as an attachment. */
export function textAttachment(text: string, name: string): NoteAttachment {
  return { name, mime: "text/plain", data: textToBase64(text) };
}

/** Why a file cannot be attached: too large for its kind; null when it can. */
export function overLimit(file: { size: number; type: string }): number | null {
  const limit = file.type.startsWith("image/") ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES;
  return file.size > limit ? limit : null;
}

/** A file read as an attachment. */
export function readAttachment(file: File): Promise<NoteAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve({ name: file.name || "file", mime: file.type || "application/octet-stream", data: url.slice(url.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Text attachments decoded, to go into the prompt of a new task (it has no attachments). */
export function promptWithText(text: string, attachments: NoteAttachment[]): string {
  const parts = [text];
  for (const a of attachments) {
    if (isImage(a)) continue;
    try {
      const bin = atob(a.data);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      parts.push(`--- ${a.name} ---\n${new TextDecoder().decode(bytes)}`);
    } catch {
      // Not base64: left out.
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

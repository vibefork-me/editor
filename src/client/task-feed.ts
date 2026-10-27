import type { TranslationKey, TranslationParams } from "../i18n/types.ts";
import type { ServerMessage } from "./protocol.generated.ts";

/**
 * One line of the chat feed while the agent works on a task.
 * `text` is the raw line; `key` and `params`, when present, give a readable localized phrase for it.
 */
export type FeedLine = {
  kind: "agent" | "tool" | "status" | "error";
  text: string;
  key?: TranslationKey;
  params?: TranslationParams;
};

/** How a task ended. */
export type TaskOutcome =
  | { kind: "done"; code: number; status: string; commit?: string }
  | { kind: "error"; error: string }
  | { kind: "cancelled" };

export type GraphPhase = "exploring" | "edit" | "build" | "test" | "check" | "done";

/** Infers the task phase from an agent message. */
export function phaseFromMessage(m: ServerMessage): GraphPhase | null {
  switch (m.type) {
    case "routing":
    case "planning":
    case "plan":
      return "exploring";
    case "started": {
      const title = m.step?.title.toLowerCase() ?? "";
      if (title.includes("test") || title.includes("тест")) return "test";
      if (title.includes("build") || title.includes("сбор")) return "build";
      if (title.includes("check") || title.includes("lint") || title.includes("провер")) return "check";
      return "edit";
    }
    case "evt": {
      if (m.ev.kind === "tool") {
        const text = `${m.ev.tool} ${m.ev.detail}`.toLowerCase();
        if (text.includes("test") || text.includes("vitest") || text.includes("pytest")) return "test";
        if (text.includes("build") || text.includes("cargo build") || text.includes("npm run build")) return "build";
        if (text.includes("check") || text.includes("clippy") || text.includes("lint")) return "check";
        if (m.ev.tool === "edit" || m.ev.tool === "write") return "edit";
      }
      return null;
    }
    case "toolchain":
      return "build";
    case "done":
      return "done";
    default:
      return null;
  }
}

/** A readable chat line for an agent message, or null for messages the chat does not show. */
export function feedLine(m: ServerMessage): FeedLine | null {
  switch (m.type) {
    case "routing":
      return { kind: "status", text: `${m.choice.label} — ${m.rating.reason}` };
    case "planning":
      return { kind: "status", text: "planning", key: "feed.planning" };
    case "plan":
      return { kind: "status", text: m.steps.map((s, i) => `${i + 1}. ${s.title}`).join("\n") };
    case "toolchain":
      return { kind: m.error ? "error" : "status", text: `${m.tool}: ${m.status}${m.error ? ` — ${m.error}` : ""}` };
    case "started":
      return {
        kind: "status",
        text: `${m.step ? `${m.step.n}/${m.step.of} ${m.step.title} · ` : ""}${m.provider} ${m.model}`,
      };
    case "evt":
      switch (m.ev.kind) {
        case "text":
          return { kind: "agent", text: m.ev.text };
        case "tool":
          return { kind: "tool", text: `${m.ev.tool} ${m.ev.detail}`.trim() };
        case "error":
          return { kind: "error", text: m.ev.text };
        default:
          return null;
      }
    case "step-done":
      return {
        kind: m.ok ? "status" : "error",
        text: `${m.n}/${m.of} ${m.ok ? "done" : "failed"}`,
        key: m.ok ? "feed.stepDone" : "feed.stepFailed",
        params: { n: m.n, of: m.of },
      };
    case "done": {
      const kind = m.code === 0 ? "status" : "error";
      if (m.status) return { kind, text: m.status };
      if (m.code === 0) return { kind, text: "exit 0", key: "project.taskDone" };
      return { kind, text: `exit ${m.code}`, key: "feed.exitCode", params: { code: m.code } };
    }
    case "error":
      return { kind: "error", text: m.error };
    default:
      return null;
  }
}

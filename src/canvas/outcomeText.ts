import type { Artifact, CheckKind, ResultKind } from "../client/protocol.generated.ts";
import type { TranslationKey, TranslationParams } from "../i18n/types.ts";

type T = (key: TranslationKey, params?: TranslationParams) => string;

/** A finished check as the stream gave it: English `text`, and `kind` / `exit` from newer agents. */
export interface CheckOutcome {
  ok: boolean;
  text: string;
  kind?: CheckKind | null;
  exit?: number | null;
}

/** How a task ended as the stream gave it: English `text` and `detail`, and `kind` / `exit` / `id` from newer agents. */
export interface ResultOutcome {
  text: string;
  detail: string;
  artifacts: Artifact[];
  kind?: ResultKind | null;
  exit?: number | null;
  id?: string | null;
}

/** A check in the person's language; the agent's text when the check has no kind (an older agent). */
export function checkText(t: T, c: CheckOutcome): string {
  if (c.kind === "build") return c.ok ? t("outcome.buildPassed") : t("outcome.buildFailed", { code: c.exit ?? "?" });
  return c.text;
}

/** The headline of a finished task in the person's language; the agent's text without a known kind. */
export function resultText(t: T, r: Pick<ResultOutcome, "text" | "kind" | "exit">): string {
  switch (r.kind) {
    case "done":
      return t("outcome.done");
    case "failed":
      return t("outcome.failed", { code: r.exit ?? "?" });
    case "cancelled":
      return t("outcome.cancelled");
    case "part_rolled_back":
      return t("outcome.partRolledBack");
    default:
      return r.text;
  }
}

/**
 * The line under the headline in the person's language: how many files changed (from the changes the task
 * reports), or which part went back. The agent's detail when there is nothing to word it from.
 */
export function resultDetail(t: T, r: ResultOutcome, label: (id: string) => string | undefined): string {
  if (r.kind === "done" || r.kind === "failed") {
    const files = new Set(r.artifacts.filter((a) => a.kind === "changes").flatMap((a) => (a.files ?? []).map((f) => f.path)));
    if (files.size > 0) return t("outcome.filesChanged", { count: files.size });
  }
  if (r.kind === "part_rolled_back" && r.id) {
    const name = label(r.id);
    if (name) return t("outcome.partRolledBackDetail", { name });
  }
  return r.detail;
}

import type { Artifact, ArtifactFile, CanvasRecord } from "../../client/protocol.generated.ts";
import type { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import { canvasNodes, type CanvasNodeView, type CanvasState } from "../canvasState.ts";

type Translate = ReturnType<typeof useTranslation>["t"];

/** A state worth a badge on a part. */
export interface Badge {
  key: TranslationKey;
  tone: "agent" | "work" | "failed" | "changed" | "task" | "version";
}

/** The part's states, in the order the card shows them. */
export function partBadges(
  n: Pick<CanvasNodeView, "isFocused" | "isThinking" | "progress" | "isFailed" | "isChanged" | "isTaskNode" | "parent"> & { kind: string },
): Badge[] {
  const out: Badge[] = [];
  if (n.isFocused) out.push({ key: "canvas.badgeAgentHere", tone: "agent" });
  if (n.isThinking) out.push({ key: "canvas.badgeThinking", tone: "agent" });
  if (n.progress !== null) out.push({ key: "canvas.badgeWorking", tone: "work" });
  if (n.isFailed) out.push({ key: "canvas.badgeFailed", tone: "failed" });
  if (n.isChanged) out.push({ key: "canvas.badgeChanged", tone: "changed" });
  if (n.isTaskNode) out.push({ key: "canvas.badgeTask", tone: "task" });
  if (n.kind === "project" && n.parent) out.push({ key: "canvas.badgeOtherVersion", tone: "version" });
  return out;
}

/** The parts next to this one, by how they are linked: what it belongs to, what is inside it, and what the agent linked it with. */
export function relatedGroups(state: CanvasState, id: string): { parent: CanvasNodeView | null; children: CanvasNodeView[]; linked: CanvasNodeView[] } {
  const nodes = canvasNodes(state);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const self = byId.get(id);
  const parent = (self?.parent && byId.get(self.parent)) || null;
  const children = nodes.filter((n) => n.parent === id && n.kind !== "project" && n.id !== id);
  const linked: CanvasNodeView[] = [];
  for (const l of Object.values(state.links)) {
    if (l.hierarchy) continue;
    const other = l.source === id ? byId.get(l.target) : l.target === id ? byId.get(l.source) : undefined;
    if (other && other.id !== id && other !== parent && !children.includes(other) && !linked.includes(other)) linked.push(other);
  }
  return { parent, children, linked };
}

/** The parts next to this one, in one list: parent, children, linked. */
export function relatedParts(state: CanvasState, id: string): CanvasNodeView[] {
  const { parent, children, linked } = relatedGroups(state, id);
  return [...(parent ? [parent] : []), ...children, ...linked];
}

/** One thing that happened to a part. */
export interface PartEvent {
  at: number;
  kind: "found" | "link" | "insight" | "think" | "change" | "failed";
  text: string;
}

/** What the agent did with one part, from the session stream: found it, linked it, understood, thought, changed, a check failed. */
export function partHistory(records: CanvasRecord[], id: string, t: Translate, label: (id: string) => string): PartEvent[] {
  const out: PartEvent[] = [];
  const linked = new Set<string>();
  const insights = new Set<string>();
  for (const { at, ev } of records) {
    if ((ev.type === "project" || ev.type === "found" || ev.type === "subsystem") && ev.id === id) out.push({ at, kind: "found", text: t("card.histFound") });
    else if (ev.type === "touch") {
      const other = ev.from === id ? ev.to : ev.to === id ? ev.from : null;
      if (other && other !== id && !linked.has(other)) {
        linked.add(other);
        out.push({ at, kind: "link", text: t("card.histLinked", { label: label(other) }) });
      }
    } else if (ev.type === "insight" && ev.id === id && !insights.has(ev.text)) {
      insights.add(ev.text);
      out.push({ at, kind: "insight", text: `“${ev.text}”` });
    } else if (ev.type === "think" && ev.id === id) out.push({ at, kind: "think", text: t("card.histThought", { text: ev.text }) });
    else if (ev.type === "change" && ev.id === id) out.push({ at, kind: "change", text: t("card.histChanged") });
    else if (ev.type === "check" && !ev.ok && ev.id === id) out.push({ at, kind: "failed", text: t("card.histFailed") });
  }
  return out;
}

/** The newest changes a task made to this part: the files it changed, from the task's "changes" artifact. */
export function changesOf(state: CanvasState, id: string): { artifact: Artifact; files: ArtifactFile[] } | null {
  const results = [...state.history.map((h) => h.artifacts), state.result?.artifacts ?? []].reverse();
  for (const artifacts of results) {
    for (const a of artifacts) {
      const files = (a.files ?? []).filter((f) => f.node === id);
      if (a.kind === "changes" && files.length > 0) return { artifact: a, files };
    }
  }
  return null;
}

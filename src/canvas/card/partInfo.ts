import type { Artifact, ArtifactFile } from "../../client/protocol.generated.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import { canvasNodes, type CanvasNodeView, type CanvasState } from "../canvasState.ts";

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

/** The parts next to this one: what it belongs to, what is inside it, and what the agent linked it with. */
export function relatedParts(state: CanvasState, id: string): CanvasNodeView[] {
  const nodes = canvasNodes(state);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const self = byId.get(id);
  const out: CanvasNodeView[] = [];
  const add = (n: CanvasNodeView | undefined) => {
    if (n && n.id !== id && !out.includes(n)) out.push(n);
  };
  add(self?.parent ? byId.get(self.parent) : undefined);
  for (const n of nodes) if (n.parent === id && n.kind !== "project") add(n);
  for (const l of Object.values(state.links)) {
    if (l.hierarchy) continue;
    if (l.source === id) add(byId.get(l.target));
    else if (l.target === id) add(byId.get(l.source));
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

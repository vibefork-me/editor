import type { Node } from "@xyflow/react";
import type { NodeCardData } from "./types.ts";

export interface CanvasA11yOptions {
  nodes: Node<NodeCardData>[];
  agentFocusNodeId: string | null;
  activeFocusedNodeId: string | null;
  setActiveFocusedNodeId: (id: string | null) => void;
}

/**
 * Keyboard navigation for the canvas according to S-024 §4.5.7:
 * - Tab enters canvas with a single roving tabindex
 * - Arrow keys navigate to neighboring nodes spatially
 * - Home key returns focus to the agent's current focus node
 * - Preserves system combinations Ctrl+L, Ctrl+1, Ctrl+2 (never intercepted)
 */
export function handleCanvasKeyDown(
  e: React.KeyboardEvent,
  { nodes, agentFocusNodeId, activeFocusedNodeId, setActiveFocusedNodeId }: CanvasA11yOptions
): void {
  // Explicitly ignore system combinations per S-024 §4.5.7
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === "l" || key === "1" || key === "2") {
      return;
    }
  }

  if (nodes.length === 0) return;

  // Home key: jump focus to agent's focus node (or first node)
  if (e.key === "Home") {
    e.preventDefault();
    const targetId = agentFocusNodeId && nodes.some((n) => n.id === agentFocusNodeId)
      ? agentFocusNodeId
      : nodes[0].id;

    setActiveFocusedNodeId(targetId);
    focusNodeElement(targetId);
    return;
  }

  // Arrow navigation
  if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    const currentId = activeFocusedNodeId || agentFocusNodeId || nodes[0].id;
    const currentNode = nodes.find((n) => n.id === currentId) || nodes[0];

    let candidate: Node<NodeCardData> | null = null;
    let minDistance = Infinity;

    for (const node of nodes) {
      if (node.id === currentNode.id) continue;

      const dx = node.position.x - currentNode.position.x;
      const dy = node.position.y - currentNode.position.y;

      let isCandidate = false;
      if (e.key === "ArrowRight" && dx > 20) {
        isCandidate = true;
      } else if (e.key === "ArrowLeft" && dx < -20) {
        isCandidate = true;
      } else if (e.key === "ArrowDown" && dy > 20) {
        isCandidate = true;
      } else if (e.key === "ArrowUp" && dy < -20) {
        isCandidate = true;
      }

      if (isCandidate) {
        const distance = Math.hypot(dx, dy);
        if (distance < minDistance) {
          minDistance = distance;
          candidate = node;
        }
      }
    }

    if (candidate) {
      setActiveFocusedNodeId(candidate.id);
      focusNodeElement(candidate.id);
    }
  }
}

function focusNodeElement(nodeId: string): void {
  const el = [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(
    (candidate) => candidate.dataset.nodeId === nodeId
  );
  el?.focus();
}

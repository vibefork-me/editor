import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphNode } from "../../client/types.ts";
import type { NodeCardData } from "./types.ts";

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  layerGapX?: number;
  nodeGapY?: number;
  startX?: number;
  startY?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  nodeWidth: 220,
  nodeHeight: 76,
  layerGapX: 280,
  nodeGapY: 110,
  startX: 40,
  startY: 40,
};

/**
 * Deterministic layered DAG layout for module nodes.
 * Guarantees stable positions across re-renders without heavy vendor libraries (elkjs/dagre).
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focusNodeId: string | null,
  handlers: {
    onFocusNode?: (nodeId: string) => void;
    onAskAbout?: (label: string) => void;
    onExplainProblem?: (nodeId: string) => Promise<string | void>;
  } = {},
  options: LayoutOptions = {}
): { nodes: Node<NodeCardData>[]; edges: Edge[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  // Calculate in-degrees and build adjacency
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  const validEdges: GraphEdge[] = [];
  for (const edge of edges) {
    if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
      adj.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
      validEdges.push(edge);
    }
  }

  // Compute layers (ranks)
  const layers = new Map<string, number>();

  // If no edges, arrange in columns of 4
  if (validEdges.length === 0) {
    nodes.forEach((n, idx) => {
      layers.set(n.id, Math.floor(idx / 4));
    });
  } else {
    // Topological / longest path ranking
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
        layers.set(id, 0);
      }
    }

    // If all nodes have incoming edges (cycle), break cycle with first node
    if (queue.length === 0 && nodes.length > 0) {
      queue.push(nodes[0].id);
      layers.set(nodes[0].id, 0);
    }

    let iterations = 0;
    const maxIterations = nodes.length * 2;
    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      const currentLayer = layers.get(current) ?? 0;

      for (const next of adj.get(current) ?? []) {
        const existingLayer = layers.get(next);
        const newLayer = currentLayer + 1;
        if (existingLayer === undefined || newLayer > existingLayer) {
          layers.set(next, newLayer);
          queue.push(next);
        }
      }
    }

    // Assign any unvisited disconnected nodes
    for (const n of nodes) {
      if (!layers.has(n.id)) {
        layers.set(n.id, 0);
      }
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const layer = layers.get(n.id) ?? 0;
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(n);
  }

  // Sort nodes within each layer by ID for deterministic stability
  const sortedLayers = [...layerGroups.keys()].sort((a, b) => a - b);
  for (const l of sortedLayers) {
    layerGroups.get(l)!.sort((a, b) => a.id.localeCompare(b.id));
  }

  // Calculate coordinates
  const flowNodes: Node<NodeCardData>[] = [];
  for (const layer of sortedLayers) {
    const nodesInLayer = layerGroups.get(layer)!;
    nodesInLayer.forEach((n, rowIdx) => {
      const posX = opts.startX + layer * opts.layerGapX;
      const posY = opts.startY + rowIdx * opts.nodeGapY;

      flowNodes.push({
        id: n.id,
        type: "moduleNode",
        position: { x: posX, y: posY },
        data: {
          id: n.id,
          label: n.label,
          status: n.status,
          summary: n.summary,
          isFocused: n.id === focusNodeId,
          onFocusNode: handlers.onFocusNode,
          onAskAbout: handlers.onAskAbout,
          onExplainProblem: handlers.onExplainProblem,
        },
      });
    });
  }

  // Generate smoothstep edges
  const flowEdges: Edge[] = validEdges.map((e, idx) => ({
    id: `e-${e.from}-${e.to}-${idx}`,
    source: e.from,
    target: e.to,
    label: e.label,
    type: "smoothstep",
    style: {
      stroke: "oklch(0.38 0.02 260)",
      strokeWidth: 1.5,
    },
  }));

  return { nodes: flowNodes, edges: flowEdges };
}

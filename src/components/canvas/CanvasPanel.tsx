import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { getAgentTransport } from "../../stores/agent-bridge.ts";
import { useGraphStore } from "../../stores/graphStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { useSessionStore } from "../../stores/sessionStore.ts";
import { useViewerStore } from "../../stores/viewerStore.ts";
import { DoneSummary } from "./DoneSummary.tsx";
import { handleCanvasKeyDown } from "./a11y.ts";
import { layoutGraph } from "./layout.ts";
import { NodeCard } from "./NodeCard.tsx";
import type { CanvasPanelProps, NodeCardData } from "./types.ts";

const nodeTypes = {
  moduleNode: NodeCard,
};

export function CanvasPanel({ className = "", onAskAbout, onSave }: CanvasPanelProps) {
  const { t } = useTranslation();
  const rawNodesMap = useGraphStore((s) => s.nodes);
  const rawEdges = useGraphStore((s) => s.edges);
  const focusNodeId = useGraphStore((s) => s.focusNodeId);
  const phase = useGraphStore((s) => s.phase);

  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const openDiff = useViewerStore((s) => s.openDiff);

  const [activeFocusedNodeId, setActiveFocusedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveHref, setSaveHref] = useState<string | null>(null);
  const nodePositions = useRef(new Map<string, { x: number; y: number }>());

  const rawNodes = useMemo(() => Array.from(rawNodesMap.values()), [rawNodesMap]);
  const rovingNodeId = activeFocusedNodeId && rawNodes.some((node) => node.id === activeFocusedNodeId)
    ? activeFocusedNodeId
    : focusNodeId && rawNodes.some((node) => node.id === focusNodeId)
      ? focusNodeId
      : rawNodes[0]?.id ?? null;
  const isReconnecting = connectionStatus === "reconnecting";

  // Handlers for node interactions
  const handleFocusNode = useCallback(
    async (nodeId: string) => {
      if (!currentProjectId) return;
      const transport = getAgentTransport();
      if (!transport) return;
      try {
        await transport.focusNode({ projectId: currentProjectId, nodeId });
      } catch (err) {
        console.warn("Failed to focus node:", err);
      }
    },
    [currentProjectId]
  );

  const handleAskAbout = useCallback(
    (label: string) => {
      onAskAbout?.(`[${label}] `);
    },
    [onAskAbout]
  );

  const handleExplainProblem = useCallback(
    async (nodeId: string): Promise<string> => {
      if (!currentProjectId) return "No project selected";
      const transport = getAgentTransport();
      if (!transport) return "Agent transport not connected";
      try {
        const res = await transport.explainNode({ projectId: currentProjectId, nodeId });
        return res.explanation;
      } catch (err) {
        return err instanceof Error ? err.message : "Failed to explain problem";
      }
    },
    [currentProjectId]
  );

  // Layout calculation
  const { nodes, edges } = useMemo<{ nodes: Node<NodeCardData>[]; edges: Edge[] }>(() => {
    return layoutGraph(
      rawNodes,
      rawEdges,
      focusNodeId,
      {
        onFocusNode: handleFocusNode,
        onAskAbout: handleAskAbout,
        onExplainProblem: handleExplainProblem,
        rovingNodeId,
        isFocusPulseDisabled: isReconnecting,
      },
      { positionsById: nodePositions.current }
    );
  }, [rawNodes, rawEdges, focusNodeId, handleFocusNode, handleAskAbout, handleExplainProblem, rovingNodeId, isReconnecting]);

  useEffect(() => {
    for (const node of nodes) {
      nodePositions.current.set(node.id, node.position);
    }
  }, [nodes]);

  // Determine if all nodes are done or phase is done
  const isAllDone = useMemo(() => {
    if (phase === "done") return true;
    if (rawNodes.length > 0 && rawNodes.every((n) => n.status === "done")) {
      return true;
    }
    return false;
  }, [phase, rawNodes]);

  const handleViewChanges = useCallback(() => {
    // Open diff viewer for project changes
    void openDiff("");
  }, [openDiff]);

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    setSaveHref(null);
    if (!currentProjectId) {
      setSaveMessage(t("canvas.saveError"));
      return;
    }
    const transport = getAgentTransport();
    if (!transport) {
      setSaveMessage(t("canvas.saveError"));
      return;
    }

    setIsSaving(true);
    try {
      const result = await transport.saveProject({ projectId: currentProjectId });
      if (result.url) {
        const url = new URL(result.url);
        if (url.protocol === "https:" && url.hostname === "github.com") {
          setSaveHref(url.href);
        }
      }
      if (result.step === "saved") {
        setSaveMessage(t("canvas.saveComplete"));
      } else if (result.step === "unchanged") {
        setSaveMessage(t("canvas.saveUnchanged"));
      } else if (result.url && result.url.startsWith("https://github.com/")) {
        setSaveMessage(t("canvas.saveNextStep"));
      } else {
        setSaveMessage(t("canvas.saveError"));
      }
    } catch {
      setSaveMessage(t("canvas.saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [currentProjectId, t]);

  return (
    <div
      role="region"
      aria-label="Module Canvas"
      tabIndex={rawNodes.length === 0 ? 0 : -1}
      onKeyDown={(e) =>
        handleCanvasKeyDown(e, {
          nodes,
          agentFocusNodeId: focusNodeId,
          activeFocusedNodeId,
          setActiveFocusedNodeId,
        })
      }
      className={`relative flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-surface outline-none ${className}`}
    >
      {/* Reconnecting overlay notice */}
      {isReconnecting && (
        <div
          data-testid="reconnecting-banner"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-warning/40 bg-surface-elevated/90 px-3.5 py-1 text-xs font-medium text-warning shadow-md backdrop-blur"
        >
          <span className="w-2 h-2 rounded-full bg-warning animate-status-reconnect" />
          <span>{t("canvas.reconnectingNotice")}</span>
        </div>
      )}

      {/* Main interactive graph */}
      {rawNodes.length === 0 ? (
        <div
          data-testid="empty-canvas"
          className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-text-muted select-none"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated border border-border mb-3">
            <svg
              className="h-6 w-6 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-text">
            {t("canvas.emptyCanvasTitle")}
          </h4>
          <p className="mt-1 max-w-sm text-xs leading-relaxed">
            {t("canvas.emptyCanvasDescription")}
          </p>
        </div>
      ) : (
        <div
          className={`h-full w-full flex-1 transition-opacity duration-300 ${
            isReconnecting ? "opacity-60 pointer-events-none" : "opacity-100"
          }`}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            zoomOnScroll={false}
            preventScrolling={false}
            minZoom={0.4}
            maxZoom={1.5}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="oklch(0.28 0.015 260)"
            />
            <Controls
              showInteractive={false}
              className="!bg-surface-elevated !border-border !fill-text !shadow-md !rounded-lg overflow-hidden [&>button]:!border-border [&>button]:!bg-surface-elevated [&>button:hover]:!bg-surface"
            />
          </ReactFlow>
        </div>
      )}

      {/* Done summary card on completion */}
      {isAllDone && (
        <DoneSummary
          onSave={onSave ?? handleSave}
          isSaving={isSaving}
          onViewChanges={handleViewChanges}
          saveMessage={saveMessage}
          saveHref={saveHref}
        />
      )}
    </div>
  );
}

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { NodePopover } from "./NodePopover.tsx";
import type { NodeCardData, NodeStatus } from "./types.ts";

export type ModuleNodeType = Node<NodeCardData, "moduleNode">;

function getNodeStatusClasses(status: NodeStatus) {
  switch (status) {
    case "exploring":
      return "border border-dashed border-accent bg-surface-elevated/90";
    case "changing":
      return "border-2 border-solid border-warning bg-surface-elevated";
    case "problem":
      return "border-2 border-solid border-danger bg-surface-elevated";
    case "done":
      return "border border-solid border-success bg-surface-elevated";
    default:
      return "border border-dashed border-border bg-surface-elevated/70 text-text-muted";
  }
}

export const NodeCard = memo(function NodeCard({ data }: NodeProps<ModuleNodeType>) {
  const { t } = useTranslation();
  const { id, label, status, summary, isFocused, onFocusNode, onAskAbout, onExplainProblem } = data;

  const statusClasses = getNodeStatusClasses(status);

  const getStatusLabel = () => {
    switch (status) {
      case "exploring":
        return t("canvas.statusExploring");
      case "changing":
        return t("canvas.statusChanging");
      case "problem":
        return t("canvas.statusProblem");
      case "done":
        return t("canvas.statusDone");
      default:
        return t("canvas.statusUnknown");
    }
  };

  const statusLabel = getStatusLabel();

  return (
    <div className="relative group">
      {/* Target handle on left for incoming edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-border !border-surface group-hover:!bg-accent transition-colors"
      />

      <NodePopover
        nodeId={id}
        label={label}
        status={status}
        summary={summary}
        onFocusNode={onFocusNode}
        onAskAbout={onAskAbout}
        onExplainProblem={onExplainProblem}
      >
        <div
          data-node-id={id}
          data-status={status}
          data-focused={isFocused}
          aria-label={`${label} (${statusLabel})`}
          className={`relative min-w-[190px] max-w-[240px] rounded-md p-3 text-left shadow-md transition-all duration-200 cursor-pointer select-none ${statusClasses} ${
            isFocused ? "ring-2 ring-accent animate-focus-pulse" : "hover:border-accent/70"
          }`}
        >
          {/* Problem corner flag (8px) per T-027 */}
          {status === "problem" && (
            <div
              data-testid="problem-flag"
              className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-r-[8px] border-t-danger border-r-danger rounded-tr-md"
              title={statusLabel}
            />
          )}

          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-semibold text-xs text-text truncate max-w-[150px]">
              {label}
            </span>

            {/* Agent focus badge: "now here" ("сейчас здесь") */}
            {isFocused && (
              <span
                data-testid="focus-badge"
                className="flex items-center gap-1 text-[10px] font-mono font-medium text-accent shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-phase-current" />
                {t("canvas.agentHere")}
              </span>
            )}
          </div>

          <div className="text-[11px] text-text-muted truncate">
            {summary || statusLabel}
          </div>
        </div>
      </NodePopover>

      {/* Source handle on right for outgoing edges */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-border !border-surface group-hover:!bg-accent transition-colors"
      />
    </div>
  );
});

import { Popover } from "@base-ui/react/popover";
import { useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { NodeStatus } from "./types.ts";

export interface NodePopoverProps {
  nodeId: string;
  label: string;
  status: NodeStatus;
  summary?: string;
  onFocusNode?: (nodeId: string) => void;
  onAskAbout?: (label: string) => void;
  onExplainProblem?: (nodeId: string) => Promise<string | void>;
  children: ReactNode;
}

export function NodePopover({
  nodeId,
  label,
  status,
  summary,
  onFocusNode,
  onAskAbout,
  onExplainProblem,
  children,
}: NodePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const handleExplain = async () => {
    if (!onExplainProblem) return;
    setIsExplaining(true);
    try {
      const res = await onExplainProblem(nodeId);
      if (typeof res === "string") {
        setExplanation(res);
      }
    } catch (err) {
      setExplanation(err instanceof Error ? err.message : "Error getting explanation");
    } finally {
      setIsExplaining(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "exploring":
        return { text: t("canvas.statusExploring"), color: "bg-accent/20 text-accent border-accent/40" };
      case "changing":
        return { text: t("canvas.statusChanging"), color: "bg-warning/20 text-warning border-warning/40" };
      case "problem":
        return { text: t("canvas.statusProblem"), color: "bg-danger/20 text-danger border-danger/40" };
      case "done":
        return { text: t("canvas.statusDone"), color: "bg-success/20 text-success border-success/40" };
      default:
        return { text: t("canvas.statusUnknown"), color: "bg-text-muted/20 text-text-muted border-border" };
    }
  };

  const badge = getStatusBadge();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        nativeButton={false}
        render={
          <div
            tabIndex={0}
            role="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen((prev) => !prev);
              }
            }}
          />
        }
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={8} align="center">
          <Popover.Popup className="z-50 w-72 rounded-lg border border-border bg-surface-elevated p-3 text-text shadow-xl outline-none text-xs data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-[transform,opacity]">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <span className="font-semibold text-sm truncate" title={label}>
                {label}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${badge.color}`}
              >
                {badge.text}
              </span>
            </div>

            {summary && (
              <p className="mt-2 text-text-muted leading-relaxed line-clamp-3">
                {summary}
              </p>
            )}

            {explanation && (
              <div className="mt-2.5 rounded bg-surface p-2 border border-danger/40 text-text">
                <span className="font-semibold text-danger block mb-0.5">
                  {t("canvas.statusProblem")}:
                </span>
                <p className="text-text leading-relaxed text-[11px] whitespace-pre-wrap">
                  {explanation}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1.5 pt-2 border-t border-border/40">
              <button
                type="button"
                className="w-full rounded bg-surface px-2.5 py-1.5 text-left font-medium text-text hover:bg-border/60 transition-colors flex items-center justify-between"
                onClick={() => {
                  onFocusNode?.(nodeId);
                  setOpen(false);
                }}
              >
                <span>{t("canvas.focusHere")}</span>
                <span className="text-[10px] text-text-muted font-mono">focus</span>
              </button>

              <button
                type="button"
                className="w-full rounded bg-surface px-2.5 py-1.5 text-left font-medium text-text hover:bg-border/60 transition-colors flex items-center justify-between"
                onClick={() => {
                  onAskAbout?.(label);
                  setOpen(false);
                }}
              >
                <span>{t("canvas.askAbout")}</span>
                <span className="text-[10px] text-accent font-mono">[chat]</span>
              </button>

              {status === "problem" && (
                <button
                  type="button"
                  disabled={isExplaining}
                  className="w-full rounded bg-danger/15 px-2.5 py-1.5 text-left font-medium text-danger hover:bg-danger/25 transition-colors disabled:opacity-60"
                  onClick={handleExplain}
                >
                  {isExplaining
                    ? t("canvas.explainingProblem")
                    : t("canvas.explainProblem")}
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useModelLabel } from "../../hooks/useModelLabel.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { useSessionStore } from "../../stores/sessionStore.ts";
import { ProjectPickerModal } from "./ProjectPickerModal.tsx";

function connectionPresentation(status: ReturnType<typeof useSessionStore.getState>["connectionStatus"]) {
  switch (status) {
    case "connected":
      return {
        label: "Connected",
        dotClass: "bg-status-connected",
        pulse: false,
      };
    case "reconnecting":
      return {
        label: "Reconnecting",
        dotClass: "bg-status-reconnecting",
        pulse: true,
      };
    default:
      return {
        label: "Offline",
        dotClass: "bg-status-offline",
        pulse: false,
      };
  }
}

export function StatusBar() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const projectMeta = useProjectStore((s) => s.projectMeta);
  const modelLabel = useModelLabel();
  const conn = connectionPresentation(connectionStatus);
  const projectLabel = projectMeta?.upstream ?? projectMeta?.projectId ?? "Project";

  return (
    <>
      <header
        className="flex h-[40px] shrink-0 items-center gap-4 border-b border-border bg-surface px-3 text-sm font-sans"
        data-testid="status-bar"
      >
        <Link
          to="/"
          className="font-semibold tracking-tight text-text hover:text-accent"
          aria-label="Vibefork home"
        >
          Vibefork
        </Link>
        <button
          type="button"
          className="max-w-[14rem] truncate font-mono text-text-muted hover:text-text"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
        >
          {projectLabel}
        </button>
        <span className="ml-auto flex items-center gap-2 text-text-muted">
          <span
            className={`inline-block size-2 rounded-full ${conn.dotClass} ${conn.pulse ? "animate-status-reconnect" : ""}`}
            aria-hidden="true"
          />
          <span>{conn.label}</span>
        </span>
        {modelLabel ? (
          <span className="rounded border border-border px-2 py-0.5 font-mono text-xs text-text-muted">
            {modelLabel}
          </span>
        ) : null}
      </header>
      <ProjectPickerModal open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { useModelLabel } from "../../hooks/useModelLabel.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { useSessionStore } from "../../stores/sessionStore.ts";
import { IconCheck } from "./icons.tsx";
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
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const projectMeta = useProjectStore((s) => s.projectMeta);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const buildStatus = useBuildStore((s) => s.status);
  const startBuild = useBuildStore((s) => s.startBuild);
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

        {currentProjectId && (
          <button
            type="button"
            data-testid="status-build-button"
            disabled={buildStatus === "building"}
            onClick={() => {
              if (buildStatus === "building") return;
              void startBuild(currentProjectId);
            }}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              buildStatus === "building"
                ? "border-accent/40 bg-accent/10 text-accent cursor-wait"
                : buildStatus === "built"
                  ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                  : buildStatus === "failed"
                    ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
                    : "border-border bg-surface-elevated text-text hover:bg-surface hover:text-accent"
            }`}
            title={t("open.buildConfirmNote")}
          >
            {buildStatus === "building" ? (
              <>
                <span className="size-2 rounded-full bg-accent animate-pulse" />
                <span>{t("build.building")}</span>
              </>
            ) : buildStatus === "built" ? (
              <>
                <IconCheck className="size-3.5 text-success" />
                <span>{t("build.succeeded")}</span>
              </>
            ) : (
              <>
                <svg className="size-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{t("build.action")}</span>
              </>
            )}
          </button>
        )}
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

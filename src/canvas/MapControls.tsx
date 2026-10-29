import { useTranslation } from "../i18n/i18nStore.ts";
import { useAiPanelStore } from "../stores/aiPanelStore.ts";
import { useGraphStore } from "../stores/graphStore.ts";
import { useSessionStore } from "../stores/sessionStore.ts";

const pill = "pointer-events-auto flex h-9 items-center gap-2 rounded-lg border bg-surface-elevated/95 px-3 text-xs shadow-lg backdrop-blur";

/** What the notice says, by the agent's code; an older agent sends none. */
function noticeKey(code: string | undefined) {
  if (code === "no_models") return "canvas.partsNoModels" as const;
  if (code === "project_empty") return "canvas.partsNoFiles" as const;
  return "canvas.partsFailed" as const;
}

/**
 * The top right island of the canvas: parts or folders, and what the map is waiting for — the model
 * drawing the parts, why folders are shown instead, the connection coming back.
 */
export function MapControls() {
  const { t } = useTranslation();
  const currentView = useGraphStore((s) => s.currentView);
  const setView = useGraphStore((s) => s.setView);
  const isDescribing = useGraphStore((s) => s.isDescribing);
  const mapNotice = useGraphStore((s) => s.mapNotice);
  const retryParts = useGraphStore((s) => s.retryParts);
  const openAiPanel = useAiPanelStore((s) => s.setOpen);
  const reconnecting = useSessionStore((s) => s.connectionStatus === "reconnecting");

  return (
    <div className="flex flex-col items-end gap-2">
      <div role="group" aria-label={t("canvas.viewToggleAria")} className={`${pill} border-border p-0.5`}>
        {(["parts", "folders"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={currentView === view}
            disabled={isDescribing}
            onClick={() => void setView(view)}
            className="rounded-md px-2.5 py-1 font-medium text-text-muted hover:text-text aria-pressed:bg-surface aria-pressed:text-text disabled:cursor-wait"
          >
            {t(view === "parts" ? "canvas.viewParts" : "canvas.viewFolders")}
          </button>
        ))}
      </div>
      {isDescribing && (
        <div data-testid="describing-banner" className={`${pill} border-accent/40 font-medium text-accent`}>
          <span className="size-2 animate-pulse rounded-full bg-accent" />
          {t("canvas.describingMap")}
        </div>
      )}
      {!isDescribing && mapNotice && (
        <div data-testid="map-notice" role="status" title={mapNotice.reason} className={`${pill} border-border text-text-muted`}>
          {t(noticeKey(mapNotice.code))}
          {mapNotice.code === "no_models" ? (
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => openAiPanel(true)}>
              {t("status.aiConnect")}
            </button>
          ) : (
            mapNotice.code !== "project_empty" && (
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => void retryParts()}>
                {t("canvas.partsRetry")}
              </button>
            )
          )}
        </div>
      )}
      {reconnecting && (
        <div data-testid="reconnecting-banner" className={`${pill} border-warning/40 font-medium text-warning`}>
          <span className="size-2 animate-status-reconnect rounded-full bg-warning" />
          {t("canvas.reconnectingNotice")}
        </div>
      )}
    </div>
  );
}

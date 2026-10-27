import { Menu } from "@base-ui/react/menu";
import { useNavigate } from "react-router-dom";
import { useModelLabel } from "../../hooks/useModelLabel.ts";
import { LOCALE_NAMES, READY_LOCALES } from "../../i18n/config.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { Locale } from "../../i18n/types.ts";
import { useAiPanelStore } from "../../stores/aiPanelStore.ts";
import { useBuildStore } from "../../stores/buildStore.ts";
import { useLayoutStore } from "../../stores/layoutStore.ts";
import { useProjectStore } from "../../stores/projectStore.ts";
import { useSessionStore, type SessionState } from "../../stores/sessionStore.ts";
import { IconChevronDown } from "./icons.tsx";

/** The page is shown only while the agent answers, so there is no "offline": only the task socket
 * reconnecting, or the first connection. */
export function connectionPresentation(status: SessionState["connectionStatus"]) {
  switch (status) {
    case "connected":
      return { label: "status.agentOk", hint: "status.agentOkHint", dotClass: "bg-status-connected", pulse: false } as const;
    case "reconnecting":
      return { label: "status.reconnecting", hint: "status.reconnectingHint", dotClass: "bg-status-reconnecting", pulse: true } as const;
    default:
      return { label: "status.connecting", hint: "status.connectingHint", dotClass: "bg-status-reconnecting", pulse: true } as const;
  }
}

const item =
  "flex w-full cursor-default items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] text-text outline-none select-none data-[highlighted]:bg-surface data-[disabled]:cursor-not-allowed data-[disabled]:text-text-muted";
const groupLabel = "px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted";
const separator = "mx-1 my-1 h-px bg-border";

export interface ProjectMenuProps {
  /** Opens the history of changes; absent while there is none. */
  onHistory?: () => void;
}

/** The project plate in the top left corner: the project's name, and its menu with everything about it. */
export function ProjectMenu({ onHistory }: ProjectMenuProps) {
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();
  const projectMeta = useProjectStore((s) => s.projectMeta);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const grantedProjects = useProjectStore((s) => s.grantedProjects);
  const isLoading = useProjectStore((s) => s.isLoading);
  const loadGrantedProjects = useProjectStore((s) => s.loadGrantedProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const connectionStatus = useSessionStore((s) => s.connectionStatus);
  const buildStatus = useBuildStore((s) => s.status);
  const startBuild = useBuildStore((s) => s.startBuild);
  const openAiPanel = useAiPanelStore((s) => s.setOpen);
  const setPanelOpen = useLayoutStore((s) => s.setOpen);
  const resetLayout = useLayoutStore((s) => s.reset);
  const modelLabel = useModelLabel();
  const conn = connectionPresentation(connectionStatus);
  const projectLabel = projectMeta?.upstream ?? projectMeta?.projectId ?? currentProjectId ?? "";

  return (
    <Menu.Root onOpenChange={(open) => open && void loadGrantedProjects()}>
      <Menu.Trigger
        data-testid="project-plate"
        aria-label={`${t("workspace.menu")}: ${projectLabel}`}
        className="pointer-events-auto flex h-9 max-w-[18rem] items-center gap-2 rounded-lg border border-border bg-surface-elevated/95 px-3 text-sm text-text shadow-lg backdrop-blur hover:border-accent data-[popup-open]:border-accent"
      >
        <span className={`inline-block size-2 shrink-0 rounded-full ${conn.dotClass} ${conn.pulse ? "animate-status-reconnect" : ""}`} aria-hidden="true" />
        <span className="truncate font-semibold">{projectLabel}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-text-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-50 outline-none">
          <Menu.Popup className="max-h-[80vh] w-72 overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1 font-sans text-text shadow-xl outline-none">
            <div className="px-2.5 py-2" title={t(conn.hint)} data-testid="connection-state">
              <div className="flex items-center gap-2 text-[13px]">
                <span className={`inline-block size-2 rounded-full ${conn.dotClass}`} aria-hidden="true" />
                <span>{t(conn.label)}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-text-muted">{t(conn.hint)}</p>
            </div>
            <Menu.Separator className={separator} />
            <Menu.Group>
              <Menu.GroupLabel className={groupLabel}>{t("workspace.projects")}</Menu.GroupLabel>
              {isLoading && grantedProjects.length === 0 ? (
                <div className="px-2.5 py-1.5 text-[13px] text-text-muted">{t("workspace.projectsLoading")}</div>
              ) : grantedProjects.length === 0 ? (
                <div className="px-2.5 py-1.5 text-[13px] text-text-muted">{t("workspace.projectsEmpty")}</div>
              ) : (
                grantedProjects.map((p) => (
                  <Menu.Item
                    key={p.projectId}
                    className={`${item} font-mono ${p.projectId === currentProjectId ? "text-accent" : ""}`}
                    onClick={() => {
                      if (p.projectId === currentProjectId) return;
                      void selectProject(p.projectId, p).then(() => navigate(`/${encodeURIComponent(p.projectId)}`));
                    }}
                  >
                    <span className="truncate">{p.upstream ?? p.projectId}</span>
                  </Menu.Item>
                ))
              )}
              <Menu.Item className={item} onClick={() => navigate("/open")}>
                {t("workspace.openAnother")}
              </Menu.Item>
            </Menu.Group>
            <Menu.Separator className={separator} />
            <Menu.Item className={item} disabled={!onHistory} onClick={() => onHistory?.()}>
              {t("workspace.history")}
              {!onHistory && <span className="ml-auto text-[11px]">{t("workspace.historyEmpty")}</span>}
            </Menu.Item>
            <Menu.Item className={item} onClick={() => setPanelOpen("files", true)}>
              {t("workspace.folder")}
            </Menu.Item>
            <Menu.Item
              className={item}
              disabled={!currentProjectId || buildStatus === "building"}
              title={t("build.confirmNote")}
              onClick={() => {
                if (!currentProjectId) return;
                setPanelOpen("journal", true);
                useLayoutStore.getState().setJournalTab("build");
                void startBuild(currentProjectId);
              }}
            >
              {buildStatus === "building" ? t("build.building") : t("workspace.build")}
            </Menu.Item>
            <Menu.Item className={item} disabled data-testid="suggest-to-author">
              {t("workspace.suggest")}
              <span className="ml-auto text-[11px]">{t("workspace.later")}</span>
            </Menu.Item>
            <Menu.Separator className={separator} />
            <Menu.Item
              className={item}
              data-testid="ai-badge"
              title={modelLabel ? `${t("status.aiHint", { name: modelLabel.name, model: modelLabel.model })} ${t("status.aiManage")}` : t("status.aiManage")}
              onClick={() => openAiPanel(true)}
            >
              {modelLabel ? t("status.ai", { name: modelLabel.name }) : t("status.aiConnect")}
            </Menu.Item>
            <Menu.Group>
              <Menu.GroupLabel className={groupLabel}>{t("workspace.language")}</Menu.GroupLabel>
              <Menu.RadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
                {READY_LOCALES.map((l) => (
                  <Menu.RadioItem key={l} value={l} lang={l} closeOnClick className={item}>
                    <Menu.RadioItemIndicator keepMounted className="w-3 text-accent data-[unchecked]:invisible">
                      ●
                    </Menu.RadioItemIndicator>
                    {LOCALE_NAMES[l]}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className={separator} />
            <Menu.Item className={item} onClick={resetLayout}>
              {t("workspace.resetLayout")}
            </Menu.Item>
            <Menu.Item className={item} disabled>
              {t("workspace.settings")}
              <span className="ml-auto text-[11px]">{t("workspace.later")}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

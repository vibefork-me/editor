import { useEffect } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";
import { useLayoutStore, type PanelId } from "../../stores/layoutStore.ts";
import { IconCodePanel, IconFilesPanel, IconJournalPanel } from "./icons.tsx";

export const PANEL_NAMES: Record<PanelId, TranslationKey> = {
  files: "workspace.filesPanel",
  code: "workspace.codePanel",
  journal: "workspace.journalPanel",
};

const ICONS = { files: IconFilesPanel, code: IconCodePanel, journal: IconJournalPanel };
// Alt+1, Alt+2, Alt+3 show or hide the panels in this order.
const ORDER: PanelId[] = ["files", "code", "journal"];

/** Buttons that show and hide the panels, next to the project plate. `errors` marks the Journal. */
export function PanelToggles({ journalError = false }: { journalError?: boolean }) {
  const { t } = useTranslation();
  const panels = useLayoutStore((s) => s.panels);
  const toggle = useLayoutStore((s) => s.toggle);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const id = ORDER[Number(e.key) - 1];
      if (!id) return;
      e.preventDefault();
      useLayoutStore.getState().toggle(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div role="toolbar" aria-label={t("workspace.panels")} className="pointer-events-auto flex h-10 items-center gap-0.5 rounded-xl border border-[#30363d] bg-[rgba(20,22,29,0.94)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur">
      {ORDER.map((id) => {
        const Icon = ICONS[id];
        const name = t(PANEL_NAMES[id]);
        const open = panels[id].open;
        const error = id === "journal" && journalError;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={open}
            aria-label={name}
            title={`${t(open ? "workspace.hidePanel" : "workspace.showPanel", { name })} (Alt+${ORDER.indexOf(id) + 1})${error ? ` · ${t("workspace.hasError")}` : ""}`}
            data-testid={`toggle-${id}`}
            onClick={() => toggle(id)}
            className="relative flex h-8 w-[34px] items-center justify-center rounded-lg text-[#8b93a7] hover:bg-surface hover:text-text aria-pressed:bg-[rgba(56,139,253,0.18)] aria-pressed:text-[#79c0ff]"
          >
            <Icon className="size-4" />
            {error && <span data-testid="journal-error-badge" className="absolute right-0.5 top-0.5 size-2 rounded-full bg-danger ring-2 ring-surface-elevated" />}
          </button>
        );
      })}
    </div>
  );
}

import { Popover } from "@base-ui/react/popover";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { TranslationKey } from "../../i18n/types.ts";

const SUPPORT_URL = "https://github.com/vibefork-me/editor/issues";

const KEYS: [string, TranslationKey][] = [
  ["Alt+1", "workspace.keyFiles"],
  ["Alt+2", "workspace.keyCode"],
  ["Alt+3", "workspace.keyJournal"],
  ["Esc", "workspace.keyClose"],
];

/** "?" in the bottom right corner: how it works, keyboard shortcuts, support. */
export function HelpButton() {
  const { t } = useTranslation();
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("workspace.help")}
        data-testid="help-button"
        className="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-border bg-surface-elevated/95 text-sm font-semibold text-text-muted shadow-lg backdrop-blur hover:border-accent hover:text-text data-[popup-open]:border-accent"
      >
        ?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-80 rounded-lg border border-border bg-surface-elevated p-4 font-sans text-[13px] text-text shadow-xl outline-none">
            <Popover.Title className="text-sm font-semibold">{t("workspace.helpTitle")}</Popover.Title>
            <Popover.Description className="mt-1 leading-snug text-text-muted">{t("workspace.helpText")}</Popover.Description>
            <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("workspace.keys")}</h3>
            <dl className="mt-1 space-y-1">
              {KEYS.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <dt className="text-text-muted">{t(label)}</dt>
                  <dd>
                    <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px]">{key}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("workspace.support")}</h3>
            <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accent hover:underline">
              {t("workspace.supportText")}
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

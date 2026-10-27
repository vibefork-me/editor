import { useEffect } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { useViewerStore } from "../../stores/viewerStore.ts";
import { CodeViewer } from "./CodeViewer.tsx";
import type { ViewerLayoutContainerProps } from "./types.ts";

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 MiB per S-002 §4.4

export function ViewerLayoutContainer({ className = "", part = null }: ViewerLayoutContainerProps) {
  const { t } = useTranslation();
  const isOpen = useViewerStore((s) => s.isOpen);
  const tabs = useViewerStore((s) => s.tabs);
  const activePath = useViewerStore((s) => s.activePath);
  const mode = useViewerStore((s) => s.mode);
  const content = useViewerStore((s) => s.content);
  const diffOriginal = useViewerStore((s) => s.diffOriginal);
  const diffModified = useViewerStore((s) => s.diffModified);
  const isLoading = useViewerStore((s) => s.isLoading);
  const error = useViewerStore((s) => s.error);
  const isTooLargeStore = useViewerStore((s) => s.isTooLarge);
  const isBinary = useViewerStore((s) => s.isBinary);
  const isForbidden = useViewerStore((s) => s.isForbidden);
  const onlyChanges = useViewerStore((s) => s.onlyChanges);
  const setOnlyChanges = useViewerStore((s) => s.setOnlyChanges);
  const closeTab = useViewerStore((s) => s.closeTab);

  // Esc closes the open file.
  useEffect(() => {
    if (!isOpen || !activePath) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        closeTab(activePath);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activePath, closeTab]);

  if (!isOpen) {
    return null;
  }

  // Check if content exceeds 2 MiB limit
  const totalLength =
    (content?.length || 0) + (diffOriginal?.length || 0) + (diffModified?.length || 0);
  const isTooLarge = isTooLargeStore || totalLength > MAX_PREVIEW_BYTES;
  const shownTabs = tabs.length > 0 ? tabs : activePath ? [{ path: activePath, mode }] : [];

  return (
    <aside
      role="complementary"
      aria-label={t("viewer.title")}
      className={`flex h-full w-full min-w-0 flex-col bg-surface ${className}`}
    >
      {/* Open files */}
      <div role="tablist" aria-label={t("code.tabs")} className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface-elevated">
        {shownTabs.map((tab) => {
          const active = tab.path === activePath;
          const name = tab.path.split("/").pop() ?? tab.path;
          return (
            <div
              key={tab.path}
              className={`group flex shrink-0 items-center gap-1 border-r border-border pl-3 pr-1 text-xs ${
                active ? "bg-surface text-text" : "text-text-muted hover:text-text"
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.path}
                className="max-w-[12rem] truncate font-mono"
                onClick={() => {
                  if (active) return;
                  const viewer = useViewerStore.getState();
                  void (tab.mode === "diff" ? viewer.openDiff(tab.path) : viewer.openFile(tab.path));
                }}
              >
                {name}
                {tab.mode === "diff" && <span className="ml-1 text-warning">●</span>}
              </button>
              <button
                type="button"
                aria-label={t("code.closeTab", { name })}
                title={active ? t("viewer.close") : t("code.closeTab", { name })}
                className="flex size-5 items-center justify-center rounded text-text-muted hover:bg-surface-elevated hover:text-text"
                onClick={() => closeTab(tab.path)}
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* What is shown: the file, its part, how the changes are shown */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase font-semibold tracking-wider ${
            mode === "diff"
              ? "bg-accent/20 text-accent border border-accent/40"
              : "bg-surface text-text-muted border border-border"
          }`}
        >
          {mode === "diff" ? t("viewer.modeDiff") : t("viewer.modeFile")}
        </span>
        <span className="min-w-0 truncate font-mono text-text" title={activePath || ""}>
          {activePath || t("viewer.noFileSelected")}
        </span>
        {part && (
          <button
            type="button"
            onClick={part.onGoTo}
            title={t("code.goToPart")}
            data-testid="code-part"
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted hover:border-accent hover:text-text"
          >
            {t("code.part", { name: part.label })}
          </button>
        )}
        {mode === "diff" && (
          <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 text-text-muted">
            <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} className="accent-[var(--color-accent)]" />
            {t("code.onlyChanges")}
          </label>
        )}
      </div>

      {/* Error / Loading / Too large status banners */}
      {error && (
        <div
          role="alert"
          className="bg-danger/20 border-b border-danger/40 px-3 py-2 text-xs text-danger font-medium"
        >
          {error}
        </div>
      )}

      {isTooLarge ? (
        <div
          role="alert"
          data-testid="too-large-banner"
          className="flex flex-1 flex-col items-center justify-center p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/20 text-warning border border-warning/40 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text">
            {t("viewer.tooLargeWarning")}
          </p>
          {totalLength > MAX_PREVIEW_BYTES && (
            <p className="mt-1 text-xs text-text-muted font-mono">
              {Math.round((totalLength / (1024 * 1024)) * 10) / 10} MiB &gt; 2 MiB
            </p>
          )}
        </div>
      ) : isBinary ? (
        <div
          role="alert"
          data-testid="binary-banner"
          className="flex flex-1 flex-col items-center justify-center p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated text-text-muted border border-border mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text">
            {t("viewer.binaryWarning")}
          </p>
        </div>
      ) : isForbidden ? (
        <div
          role="alert"
          data-testid="forbidden-banner"
          className="flex flex-1 flex-col items-center justify-center p-8 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/20 text-danger border border-danger/40 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-text">
            {t("viewer.forbiddenWarning")}
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-1 items-center justify-center p-8 text-xs text-text-muted">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-accent animate-phase-current" />
            {t("viewer.loading")}
          </span>
        </div>
      ) : (
        <CodeViewer
          activePath={activePath}
          mode={mode}
          content={content}
          diffOriginal={diffOriginal}
          diffModified={diffModified}
          onlyChanges={onlyChanges}
          readOnly={true}
        />
      )}
    </aside>
  );
}

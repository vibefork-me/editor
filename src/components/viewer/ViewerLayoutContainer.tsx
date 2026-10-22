import { useEffect } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { useViewerStore } from "../../stores/viewerStore.ts";
import { CodeViewer } from "./CodeViewer.tsx";
import type { ViewerLayoutContainerProps } from "./types.ts";

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 MiB per S-002 §4.4

export function ViewerLayoutContainer({ className = "" }: ViewerLayoutContainerProps) {
  const { t } = useTranslation();
  const isOpen = useViewerStore((s) => s.isOpen);
  const activePath = useViewerStore((s) => s.activePath);
  const mode = useViewerStore((s) => s.mode);
  const content = useViewerStore((s) => s.content);
  const diffOriginal = useViewerStore((s) => s.diffOriginal);
  const diffModified = useViewerStore((s) => s.diffModified);
  const isLoading = useViewerStore((s) => s.isLoading);
  const error = useViewerStore((s) => s.error);
  const closeViewer = useViewerStore((s) => s.closeViewer);

  // Close viewer on Esc key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeViewer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeViewer]);

  if (!isOpen) {
    return null;
  }

  // Check if content exceeds 2 MiB limit
  const totalLength =
    (content?.length || 0) + (diffOriginal?.length || 0) + (diffModified?.length || 0);
  const isTooLarge = totalLength > MAX_PREVIEW_BYTES;

  return (
    <aside
      role="complementary"
      aria-label={t("viewer.title")}
      className={`flex h-full w-[min(50%,calc(100vw-400px))] min-w-[480px] flex-col border-l border-border bg-surface shadow-2xl z-20 transition-all duration-300 ${className}`}
    >
      {/* Viewer Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-3 bg-surface-elevated shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono uppercase font-semibold tracking-wider ${
              mode === "diff"
                ? "bg-accent/20 text-accent border border-accent/40"
                : "bg-surface text-text-muted border border-border"
            }`}
          >
            {mode === "diff" ? t("viewer.modeDiff") : t("viewer.modeFile")}
          </span>
          <span
            className="truncate font-mono text-xs text-text font-medium"
            title={activePath || ""}
          >
            {activePath || t("viewer.noFileSelected")}
          </span>
        </div>

        <button
          type="button"
          aria-label={t("viewer.close")}
          className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text transition-colors"
          onClick={closeViewer}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
          <p className="mt-1 text-xs text-text-muted font-mono">
            {Math.round(totalLength / (1024 * 1024) * 10) / 10} MiB &gt; 2 MiB
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
          readOnly={true}
        />
      )}
    </aside>
  );
}

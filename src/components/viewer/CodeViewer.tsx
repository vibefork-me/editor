import { lazy, Suspense } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { CodeViewerProps } from "./types.ts";

const LazyMonacoEditor = lazy(() => import("./MonacoEditorView.tsx"));

export function CodeViewer(props: CodeViewerProps) {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center p-8 text-sm text-text-muted font-sans">
          {t("viewer.loadingEditor")}
        </div>
      }
    >
      <LazyMonacoEditor {...props} />
    </Suspense>
  );
}

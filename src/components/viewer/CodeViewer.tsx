import { lazy, Suspense } from "react";
import type { CodeViewerProps } from "./types.ts";

const LazyMonacoEditor = lazy(() => import("./MonacoEditorView.tsx"));

export function CodeViewer(props: CodeViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center p-8 text-sm text-text-muted font-sans">
          Loading editor...
        </div>
      }
    >
      <LazyMonacoEditor {...props} />
    </Suspense>
  );
}

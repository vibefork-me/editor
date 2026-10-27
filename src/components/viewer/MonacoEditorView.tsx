import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";
import type { CodeViewerProps } from "./types.ts";

function detectLanguage(path: string | null): string {
  if (!path) return "plaintext";
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "rs":
      return "rust";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

export function MonacoEditorView({
  activePath,
  mode,
  content,
  diffOriginal,
  diffModified,
  readOnly = true,
  onlyChanges = false,
}: CodeViewerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [monacoLoaded, setMonacoLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let editorInstance: { dispose: () => void } | null = null;

    // Check if we are running in non-browser or test environment without layout
    if (typeof window === "undefined" || !containerRef.current) {
      return;
    }

    // Dynamic import of monaco-editor to preserve first-screen budget
    import("monaco-editor")
      .then((monaco) => {
        if (!isMounted || !containerRef.current) return;
        setMonacoLoaded(true);

        const language = detectLanguage(activePath);

        if (mode === "diff") {
          const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
            readOnly,
            theme: "vs-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            contextmenu: false,
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 13,
            // The whole file with its changes marked in the margin; or only the changed regions.
            renderSideBySide: false,
            renderMarginRevertIcon: false,
            hideUnchangedRegions: { enabled: onlyChanges, contextLineCount: 3, minimumLineCount: 3 },
          });
          // The first change is in view when the file opens.
          const revealed = diffEditor.onDidUpdateDiff(() => {
            revealed.dispose();
            diffEditor.revealFirstDiff();
          });

          const origModel = monaco.editor.createModel(diffOriginal || "", language);
          const modModel = monaco.editor.createModel(diffModified || "", language);

          diffEditor.setModel({
            original: origModel,
            modified: modModel,
          });

          editorInstance = {
            dispose() {
              diffEditor.dispose();
              origModel.dispose();
              modModel.dispose();
            },
          };
        } else {
          const editor = monaco.editor.create(containerRef.current, {
            value: content || "",
            language,
            readOnly,
            theme: "vs-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            contextmenu: false,
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: 13,
          });

          editorInstance = editor;
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      isMounted = false;
      editorInstance?.dispose();
    };
  }, [activePath, mode, content, diffOriginal, diffModified, readOnly, onlyChanges]);

  return (
    <div className="relative h-full w-full min-h-0 flex-1 overflow-hidden bg-[#1e1e1e] font-mono text-sm">
      <div ref={containerRef} className="h-full w-full" data-testid="monaco-container" />

      {/* Accessible fallback for test environments or while loading */}
      {(!monacoLoaded || loadError) && (
        <div
          data-testid="code-fallback-view"
          className="absolute inset-0 overflow-auto p-4 font-mono text-xs text-text leading-relaxed bg-surface select-text"
        >
          {mode === "diff" ? (
            <div className="space-y-4">
              <div className="border border-border rounded p-2">
                <span className="text-text-muted text-[11px] block mb-1">{t("viewer.original")}</span>
                <pre className="text-danger whitespace-pre-wrap">{diffOriginal || t("viewer.empty")}</pre>
              </div>
              <div className="border border-border rounded p-2">
                <span className="text-text-muted text-[11px] block mb-1">{t("viewer.modified")}</span>
                <pre className="text-success whitespace-pre-wrap">{diffModified || t("viewer.empty")}</pre>
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap">{content || t("viewer.emptyFile")}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default MonacoEditorView;

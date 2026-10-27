import { useMemo } from "react";
import type { CanvasState } from "../../canvas/canvasState.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";
import { useViewerStore } from "../../stores/viewerStore.ts";
import { fileTree, knownFiles, type TreeEntry } from "./files.ts";
import { IconFile, IconFolder } from "./icons.tsx";

const row = "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-[12.5px] hover:bg-surface-elevated";

/** Opens a file in the code panel: a changed one with its changes marked. */
function open(path: string, changed: boolean) {
  const viewer = useViewerStore.getState();
  void (changed ? viewer.openDiff(path) : viewer.openFile(path));
}

function Entry({ entry, depth, changed, active }: { entry: TreeEntry; depth: number; changed: ReadonlySet<string>; active: string | null }) {
  const { t } = useTranslation();
  const pad = { paddingLeft: `${depth * 12 + 6}px` };
  if (entry.children) {
    const hasChanges = [...changed].some((p) => p.startsWith(`${entry.path}/`));
    return (
      <li>
        <details open={depth < 1 || hasChanges}>
          <summary className={`${row} cursor-pointer list-none text-text-muted`} style={pad}>
            <IconFolder className="size-3.5 shrink-0" />
            <span className="truncate">{entry.name}</span>
            {hasChanges && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />}
          </summary>
          <ul>
            {entry.children.map((c) => (
              <Entry key={c.path} entry={c} depth={depth + 1} changed={changed} active={active} />
            ))}
          </ul>
        </details>
      </li>
    );
  }
  const isChanged = changed.has(entry.path);
  return (
    <li>
      <button
        type="button"
        className={`${row} ${entry.path === active ? "bg-accent/15 text-accent" : "text-text"}`}
        style={pad}
        title={entry.path}
        onClick={() => open(entry.path, isChanged)}
      >
        <IconFile className="size-3.5 shrink-0 text-text-muted" />
        <span className="truncate">{entry.name}</span>
        {isChanged && (
          <span className="ml-auto shrink-0 text-[10.5px] font-semibold text-warning" title={t("files.changedMark")}>
            M
          </span>
        )}
      </button>
    </li>
  );
}

/** "Files": what the agent changed, by its changes, and the tree of the project with marks. */
export function FilesPanel({ state, partLabel }: { state: CanvasState; partLabel: (id: string) => string }) {
  const { t } = useTranslation();
  const active = useViewerStore((s) => s.activePath);
  const changed = useMemo(() => new Set(state.changedFiles.map((f) => f.path)), [state.changedFiles]);
  const tree = useMemo(() => fileTree(knownFiles(state)), [state]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2 font-sans" data-testid="files-panel">
      <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("files.changed")}</h3>
      {state.changedFiles.length === 0 ? (
        <p className="px-3 pb-2 text-[12.5px] text-text-muted">{t("files.noChanges")}</p>
      ) : (
        <ul className="px-1.5 pb-2" data-testid="changed-files">
          {state.changedFiles.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                className={`${row} flex-col !items-start gap-0 ${f.path === active ? "bg-accent/15" : ""}`}
                title={f.path}
                onClick={() => open(f.path, true)}
              >
                <span className="flex w-full items-center gap-1.5">
                  <IconFile className="size-3.5 shrink-0 text-warning" />
                  <span className="truncate text-text">{f.path.split("/").pop()}</span>
                </span>
                <span className="w-full truncate pl-5 text-[11px] text-text-muted">{f.node ? partLabel(f.node) : f.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-1 border-t border-border px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{t("files.tree")}</h3>
      {tree.length === 0 ? (
        <p className="px-3 text-[12.5px] text-text-muted">{t("files.treeEmpty")}</p>
      ) : (
        <ul className="px-1.5" data-testid="file-tree">
          {tree.map((e) => (
            <Entry key={e.path} entry={e} depth={0} changed={changed} active={active} />
          ))}
        </ul>
      )}
    </div>
  );
}

export interface CodeViewerProps {
  activePath: string | null;
  mode: "file" | "diff";
  content?: string | null;
  diffOriginal?: string | null;
  diffModified?: string | null;
  readOnly?: boolean;
  /** Diff mode: only the changed regions instead of the whole file with marks. */
  onlyChanges?: boolean;
}

export interface ViewerLayoutContainerProps {
  className?: string;
  /** The part of the map the file belongs to, with the way to show it there. */
  part?: { label: string; onGoTo: () => void } | null;
}

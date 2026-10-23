export interface CodeViewerProps {
  activePath: string | null;
  mode: "file" | "diff";
  content?: string | null;
  diffOriginal?: string | null;
  diffModified?: string | null;
  readOnly?: boolean;
}

export interface ViewerLayoutContainerProps {
  className?: string;
}

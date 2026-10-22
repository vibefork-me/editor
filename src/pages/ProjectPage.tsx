import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { CanvasPanel } from "../components/canvas/index.ts";
import { PhaseRail } from "../components/shell/PhaseRail.tsx";
import { StatusBar } from "../components/shell/StatusBar.tsx";
import { ViewerLayoutContainer } from "../components/viewer/index.ts";
import { useProjectShellSync } from "../hooks/useProjectShellSync.ts";
import { useProjectStore } from "../stores/projectStore.ts";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const selectProject = useProjectStore((s) => s.selectProject);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  useProjectShellSync();

  useEffect(() => {
    if (!projectId || projectId === currentProjectId) return;
    void selectProject(projectId);
  }, [projectId, currentProjectId, selectProject]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-surface font-sans text-text">
      <StatusBar />
      <PhaseRail />
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden relative">
        <CanvasPanel />
        <ViewerLayoutContainer />
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { PhaseRail } from "../components/shell/PhaseRail.tsx";
import { StatusBar } from "../components/shell/StatusBar.tsx";
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
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-text-muted">
        Canvas and chat will mount here.
      </div>
    </div>
  );
}

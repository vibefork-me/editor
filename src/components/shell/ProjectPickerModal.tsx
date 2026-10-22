import { Dialog } from "@base-ui/react/dialog";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "../../stores/projectStore.ts";

export type ProjectPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectPickerModal({ open, onOpenChange }: ProjectPickerModalProps) {
  const navigate = useNavigate();
  const grantedProjects = useProjectStore((s) => s.grantedProjects);
  const isLoading = useProjectStore((s) => s.isLoading);
  const loadGrantedProjects = useProjectStore((s) => s.loadGrantedProjects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  useEffect(() => {
    if (open) void loadGrantedProjects();
  }, [open, loadGrantedProjects]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface-elevated p-4 font-sans text-text shadow-lg outline-none data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-[transform,opacity]">
          <Dialog.Title className="text-base font-semibold">Projects</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-muted">
            Choose a project to open in the editor.
          </Dialog.Description>
          <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto" role="list">
            {isLoading ? (
              <li className="text-sm text-text-muted">Loading…</li>
            ) : grantedProjects.length === 0 ? (
              <li className="text-sm text-text-muted">No projects available.</li>
            ) : (
              grantedProjects.map((project) => {
                const label = project.upstream ?? project.projectId;
                const selected = project.projectId === currentProjectId;
                return (
                  <li key={project.projectId} role="listitem">
                    <button
                      type="button"
                      className={`w-full rounded px-2 py-2 text-left font-mono text-sm hover:bg-surface ${
                        selected ? "bg-surface text-accent" : "text-text"
                      }`}
                      onClick={() => {
                        void selectProject(project.projectId, project).then(() => {
                          navigate(`/${encodeURIComponent(project.projectId)}`);
                          onOpenChange(false);
                        });
                      }}
                    >
                      {label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="mt-4 flex justify-end">
            <Dialog.Close className="rounded border border-border px-3 py-1.5 text-sm text-text-muted hover:text-text">
              Close
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

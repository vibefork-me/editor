import { Link, useParams } from "react-router-dom";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="text-center space-y-4 max-w-md">
      <p className="text-xl font-medium text-neutral-200">Project shell</p>
      <p className="text-sm text-neutral-400 font-mono">{projectId ?? "—"}</p>
      <p className="text-sm text-neutral-500">
        Canvas, chat, and phase rail will mount here.
      </p>
      <Link className="text-sm text-neutral-400 underline" to="/">
        Back to home
      </Link>
    </div>
  );
}

import { Link, useSearchParams } from "react-router-dom";

export function OpenPage() {
  const [params] = useSearchParams();
  const repo = params.get("repo") ?? "";
  const ref = params.get("ref");
  const path = params.get("path");

  return (
    <div className="text-center space-y-4 max-w-lg">
      <p className="text-xl font-medium text-neutral-200">Open from the site</p>
      <p className="text-sm text-neutral-400 break-all font-mono">
        {repo || "Missing repo query parameter"}
      </p>
      {ref ? (
        <p className="text-sm text-neutral-500">
          ref: <span className="font-mono">{ref}</span>
        </p>
      ) : null}
      {path ? (
        <p className="text-sm text-neutral-500">
          path: <span className="font-mono">{path}</span>
        </p>
      ) : null}
      <p className="text-sm text-neutral-500">
        Lookup, clone, and navigation to /{"{projectId}"} will run here.
      </p>
      <Link className="text-sm text-neutral-400 underline" to="/">
        Back to home
      </Link>
    </div>
  );
}

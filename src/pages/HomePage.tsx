import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="text-center space-y-4 max-w-md">
      <p className="text-xl font-medium text-neutral-200">Choose a project</p>
      <p className="text-sm text-neutral-400">
        Onboarding and project list will live here.
      </p>
      <p className="text-sm text-neutral-500">
        Example:{" "}
        <Link className="text-neutral-300 underline" to="/demo-project">
          /demo-project
        </Link>
      </p>
    </div>
  );
}

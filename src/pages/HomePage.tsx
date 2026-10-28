import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.ts";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import { useProjectParam } from "../hooks/useProjectParam.ts";

export function HomePage() {
  const { t } = useI18n();
  const client = useAgentClient();
  // `?project=<name>`: the project opens; the start screen stays only while it is checked or when it cannot.
  const { checking, reason } = useProjectParam(client);

  if (checking) return null;

  return (
    <div className="text-center space-y-4 max-w-md">
      {reason ? (
        <p role="alert" className="text-sm text-red-400">
          {t(reason)}
        </p>
      ) : null}
      <p className="text-xl font-medium text-neutral-200">{t("home.chooseProject")}</p>
      <p className="text-sm text-neutral-400">
        {t("home.onboardingPlaceholder")}
      </p>
      <p className="text-sm text-neutral-500">
        {t("common.example")}{" "}
        <Link className="text-neutral-300 underline" to="/demo-project">
          /demo-project
        </Link>
      </p>
    </div>
  );
}

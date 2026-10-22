import { Link } from "react-router-dom";
import { useI18n } from "../i18n/index.ts";

export function HomePage() {
  const { t } = useI18n();

  return (
    <div className="text-center space-y-4 max-w-md">
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

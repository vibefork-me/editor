import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/index.ts";

export function OpenPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const repo = params.get("repo") ?? "";
  const ref = params.get("ref");
  const path = params.get("path");

  return (
    <div className="text-center space-y-4 max-w-lg">
      <p className="text-xl font-medium text-neutral-200">{t("open.title")}</p>
      <p className="text-sm text-neutral-400 break-all font-mono">
        {repo || t("open.missingRepo")}
      </p>
      {ref ? (
        <p className="text-sm text-neutral-500">
          {t("open.refLabel")} <span className="font-mono">{ref}</span>
        </p>
      ) : null}
      {path ? (
        <p className="text-sm text-neutral-500">
          {t("open.pathLabel")} <span className="font-mono">{path}</span>
        </p>
      ) : null}
      <p className="text-sm text-neutral-500">
        {t("open.workflowNotice")}
      </p>
      <Link className="text-sm text-neutral-400 underline" to="/">
        {t("common.backToHome")}
      </Link>
    </div>
  );
}

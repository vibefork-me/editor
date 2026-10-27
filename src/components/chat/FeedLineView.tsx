import type { FeedLine } from "../../client/task-feed.ts";
import { useTranslation } from "../../i18n/i18nStore.ts";

const RAW_CLASS: Record<FeedLine["kind"], string> = {
  agent: "text-text",
  tool: "text-neutral-500 font-mono text-xs",
  status: "text-neutral-500 font-mono text-xs",
  error: "text-red-400",
};

/** One chat feed line: a readable phrase when there is one, with the raw line under «Details». */
export function FeedLineView({ line }: { line: FeedLine }) {
  const { t } = useTranslation();

  if (!line.key) {
    return <p className={`whitespace-pre-wrap break-words ${RAW_CLASS[line.kind]}`}>{line.text}</p>;
  }

  return (
    <div className={`break-words ${line.kind === "error" ? "text-red-400" : "text-neutral-400 text-xs"}`}>
      <p>{t(line.key, line.params)}</p>
      <details className="text-xs text-neutral-500">
        <summary className="cursor-pointer select-none">{t("feed.details")}</summary>
        <code className="block whitespace-pre-wrap font-mono">{line.text}</code>
      </details>
    </div>
  );
}

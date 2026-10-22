import { useState } from "react";
import {
  WINDOWS_INSTALL_PS_COMMAND,
  type AgentOfflineReason,
} from "../client/probe-agent-reachability.ts";
import { useI18n } from "../i18n/index.ts";

export type AgentOfflineScreenProps = {
  reason: AgentOfflineReason;
  installCommand?: string;
  exiting?: boolean;
};

export function AgentOfflineScreen({
  reason,
  installCommand = WINDOWS_INSTALL_PS_COMMAND,
  exiting = false,
}: AgentOfflineScreenProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyInstallCommand() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div
      className={`mx-auto w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900/90 p-8 shadow-lg transition-opacity duration-200 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
      role="region"
      aria-live="polite"
      aria-label="Agent connection"
    >
      {reason === "agent-not-running" ? (
        <AgentNotRunningPanel
          installCommand={installCommand}
          copied={copied}
          copyFailed={copyFailed}
          onCopy={copyInstallCommand}
        />
      ) : (
        <LocalNetworkBlockedPanel />
      )}
    </div>
  );
}

function AgentNotRunningPanel({
  installCommand,
  copied,
  copyFailed,
  onCopy,
}: {
  installCommand: string;
  copied: boolean;
  copyFailed: boolean;
  onCopy: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 text-center">
      <h2 className="text-xl font-semibold text-neutral-100 leading-snug">
        {t("agentOffline.notRunningTitle")}
      </h2>
      <p className="text-sm text-neutral-400">
        {t("agentOffline.notRunningDescription")}
      </p>
      <a
        href="vibefork://start"
        className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300"
      >
        {t("agentOffline.openAgent")}
      </a>
      <div className="space-y-2 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {t("agentOffline.installHeader")}
        </p>
        <div className="flex gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-3">
          <code className="flex-1 overflow-x-auto text-xs text-neutral-200 whitespace-nowrap">
            {installCommand}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-md border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 cursor-pointer"
          >
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
        {copyFailed ? (
          <p className="text-xs text-amber-400">{t("agentOffline.copyFailedHint")}</p>
        ) : null}
      </div>
    </div>
  );
}

function LocalNetworkBlockedPanel() {
  const { t } = useI18n();

  return (
    <div className="space-y-5 text-left">
      <h2 className="text-xl font-semibold text-neutral-100 text-center leading-snug">
        {t("agentOffline.networkBlockedTitle")}
      </h2>
      <p className="text-sm text-neutral-400">
        {t("agentOffline.networkBlockedDescription", { domain: "code.vibefork.me" })}
      </p>
      <ol className="list-decimal space-y-3 pl-5 text-sm text-neutral-300">
        <li>
          <span className="font-medium text-neutral-200">{t("agentOffline.chromeEdgeTitle")}</span>
          <span className="block text-neutral-400 mt-1">
            {t("agentOffline.chromeEdgeInstructions")}
          </span>
        </li>
        <li>
          <span className="font-medium text-neutral-200">{t("agentOffline.firefoxTitle")}</span>
          <span className="block text-neutral-400 mt-1">
            {t("agentOffline.firefoxInstructions")}
          </span>
        </li>
      </ol>
    </div>
  );
}

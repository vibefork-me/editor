import { useState } from "react";
import {
  WINDOWS_INSTALL_PS_COMMAND,
  type AgentOfflineReason,
} from "../client/probe-agent-reachability.ts";

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
  return (
    <div className="space-y-6 text-center">
      <h2 className="text-xl font-semibold text-neutral-100 leading-snug">
        Vibefork Agent не запущен на вашем компьютере
      </h2>
      <p className="text-sm text-neutral-400">
        Запустите локальный агент или установите его одной командой в PowerShell.
      </p>
      <a
        href="vibefork://start"
        className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-5 py-3 text-sm font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300"
      >
        Открыть агент
      </a>
      <div className="space-y-2 text-left">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Установка (PowerShell)
        </p>
        <div className="flex gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-3">
          <code className="flex-1 overflow-x-auto text-xs text-neutral-200 whitespace-nowrap">
            {installCommand}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-md border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
        {copyFailed ? (
          <p className="text-xs text-amber-400">Выделите команду и скопируйте вручную.</p>
        ) : null}
      </div>
    </div>
  );
}

function LocalNetworkBlockedPanel() {
  return (
    <div className="space-y-5 text-left">
      <h2 className="text-xl font-semibold text-neutral-100 text-center leading-snug">
        Браузер ограничил доступ к локальной сети
      </h2>
      <p className="text-sm text-neutral-400">
        Чтобы редактор подключился к агенту на этом компьютере, разрешите доступ к устройствам в
        локальной сети для сайта <span className="text-neutral-300">code.vibefork.me</span>.
      </p>
      <ol className="list-decimal space-y-3 pl-5 text-sm text-neutral-300">
        <li>
          <span className="font-medium text-neutral-200">Google Chrome или Microsoft Edge</span>
          <span className="block text-neutral-400 mt-1">
            Откройте значок замка слева от адресной строки → «Разрешения для сайта» → «Локальная
            сеть» → «Разрешить». Обновите страницу не нужно — подключение проверится автоматически.
          </span>
        </li>
        <li>
          <span className="font-medium text-neutral-200">Mozilla Firefox</span>
          <span className="block text-neutral-400 mt-1">
            Нажмите значок «i» в адресной строке → «Разрешения» → найдите доступ к локальной сети
            (Local Network) и выберите «Разрешить» для этого сайта.
          </span>
        </li>
      </ol>
    </div>
  );
}

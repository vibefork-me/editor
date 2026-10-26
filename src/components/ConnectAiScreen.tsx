import type { AiProvider } from "../client/types.ts";
import { useI18n } from "../i18n/index.ts";
import { IconCheck } from "./shell/icons.tsx";
import { LanguageSwitcher } from "./LanguageSwitcher.tsx";

export type ConnectAiScreenProps = {
  providers?: AiProvider[];
  connectingProvider?: string | null;
  onConnect?: (providerId: string, mode?: "agent" | "user") => void;
  onDisconnect?: (providerId: string) => void;
  isChecking?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
};

const DEFAULT_PROVIDERS: AiProvider[] = [
  { id: "claude", kind: "subscription", installed: true, installing: false, connected: "no" },
  { id: "codex", kind: "subscription", installed: true, installing: false, connected: "no" },
  { id: "custom", kind: "custom", installed: true, installing: false, connected: "no" },
  { id: "gemini", kind: "free", installed: true, installing: false, connected: "no" },
  { id: "openrouter", kind: "free", installed: true, installing: false, connected: "no" },
];

const PROVIDER_NAMES: Record<string, string> = {
  claude: "Claude",
  codex: "ChatGPT (Codex)",
  gemini: "Google AI Studio (Gemini)",
  openrouter: "OpenRouter",
  custom: "OpenAI-compatible API",
};

export function ConnectAiScreen({
  providers = DEFAULT_PROVIDERS,
  connectingProvider = null,
  onConnect,
  onDisconnect,
  isChecking = false,
  errorMessage = null,
  onRetry,
}: ConnectAiScreenProps) {
  const { t } = useI18n();
  const list = providers.length > 0 ? providers : DEFAULT_PROVIDERS;

  return (
    <div
      className="mx-auto w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-900/90 p-6 sm:p-8 shadow-xl space-y-6 text-neutral-100"
      role="region"
      aria-live="polite"
      aria-label={t("connectAi.title")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold leading-snug text-neutral-100">
            {t("connectAi.title")}
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {t("connectAi.description")}
          </p>
        </div>
        <div className="shrink-0">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t("connectAi.whatWorksTitle")}
        </h3>
        <div className="grid gap-3">
          {list.map((provider) => {
            const isConnecting = connectingProvider === provider.id;
            const isConnected = provider.connected === "yes";
            const isInstalling = provider.installing;
            const name =
              provider.id === "custom"
                ? t("connectAi.optionCustomTitle")
                : provider.id === "gemini"
                  ? t("connectAi.optionGeminiTitle")
                  : PROVIDER_NAMES[provider.id] ?? provider.id;

            return (
              <div
                key={provider.id}
                className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 space-y-3"
                data-testid={`provider-card-${provider.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-100 text-sm">
                      {name}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        provider.kind === "subscription"
                          ? "border border-blue-900/60 bg-blue-950/50 text-blue-300"
                          : provider.kind === "custom"
                            ? "border border-amber-900/60 bg-amber-950/50 text-amber-300"
                            : "border border-emerald-900/60 bg-emerald-950/50 text-emerald-300"
                      }`}
                    >
                      {provider.kind === "subscription"
                        ? t("connectAi.subscriptionBadge")
                        : provider.kind === "custom"
                          ? t("connectAi.customBadge")
                          : t("connectAi.freeBadge")}
                    </span>
                    {provider.host && (
                      <span
                        data-testid={`host-badge-${provider.id}`}
                        className="rounded border border-neutral-700 bg-neutral-800/80 px-2 py-0.5 font-mono text-[11px] text-neutral-300"
                      >
                        {provider.host}
                      </span>
                    )}
                    {provider.userSignedIn && (
                      <span
                        data-testid={`mode-badge-${provider.id}`}
                        className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border border-purple-900/60 bg-purple-950/50 text-purple-300"
                      >
                        {provider.mode === "user"
                          ? t("connectAi.modeBadgeUser")
                          : t("connectAi.modeBadgeSeparate")}
                      </span>
                    )}
                  </div>

                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {t("connectAi.connectedBadge")}
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {provider.id === "claude"
                    ? t("connectAi.optionSubscriptionDescription")
                    : provider.id === "codex"
                      ? "ChatGPT Plus / Codex (OpenAI)"
                      : provider.id === "custom"
                        ? t("connectAi.optionCustomDescription")
                        : provider.id === "gemini"
                          ? t("connectAi.optionGeminiDescription")
                          : t("connectAi.optionOpenRouterDescription")}
                </p>

                {provider.userSignedIn && (
                  <div
                    className="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-3 space-y-2.5 text-left"
                    data-testid={`cli-home-choice-${provider.id}`}
                  >
                    <div
                      className={`rounded-md border p-2.5 transition-colors ${
                        provider.mode !== "user"
                          ? "border-neutral-700 bg-neutral-800/50"
                          : "border-neutral-800/50 bg-neutral-950/30"
                      }`}
                      data-testid={`mode-option-agent-${provider.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral-200">
                          {t("connectAi.modeSeparateTitle")}
                        </span>
                        {provider.mode !== "user" ? (
                          <span className="text-[10px] text-emerald-400 font-medium">✓ {t("connectAi.modeBadgeSeparate")}</span>
                        ) : (
                          <button
                            type="button"
                            disabled={isConnecting || isChecking}
                            onClick={() => onConnect?.(provider.id, "agent")}
                            className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                            data-testid={`switch-to-agent-${provider.id}`}
                          >
                            {t("connectAi.switchToAgentAction")}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                        {t("connectAi.modeSeparateDescription")}
                      </p>
                    </div>

                    <div
                      className={`rounded-md border p-2.5 transition-colors ${
                        provider.mode === "user"
                          ? "border-neutral-700 bg-neutral-800/50"
                          : "border-neutral-800/50 bg-neutral-950/30"
                      }`}
                      data-testid={`mode-option-user-${provider.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-neutral-200">
                          {t("connectAi.modeUserTitle")}
                        </span>
                        {provider.mode === "user" ? (
                          <span className="text-[10px] text-emerald-400 font-medium">✓ {t("connectAi.modeBadgeUser")}</span>
                        ) : (
                          <button
                            type="button"
                            disabled={isConnecting || isChecking}
                            onClick={() => onConnect?.(provider.id, "user")}
                            className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                            data-testid={`switch-to-user-${provider.id}`}
                          >
                            {t("connectAi.switchToUserAction")}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                        {t("connectAi.modeUserDescription")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Status & Actions */}
                <div>
                  {isConnected && (provider.id === "custom" || provider.id === "gemini") ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onConnect?.(provider.id)}
                        disabled={isConnecting || isChecking}
                        className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                        data-testid={`change-${provider.id}`}
                      >
                        {t("connectAi.changeAction")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDisconnect?.(provider.id)}
                        disabled={isConnecting || isChecking}
                        className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                        data-testid={`disconnect-${provider.id}`}
                      >
                        {t("connectAi.disconnectAction")}
                      </button>
                    </div>
                  ) : isConnected && provider.id === "openrouter" ? (
                    <button
                      type="button"
                      onClick={() => onConnect?.(provider.id)}
                      disabled={isConnecting || isChecking}
                      className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                    >
                      {t("connectAi.replaceKeyAction")}
                    </button>
                  ) : isConnected ? null : isInstalling ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 rounded-md border border-blue-900/40 bg-blue-950/30 px-3 py-2 text-xs text-blue-300 animate-slide-up"
                    >
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping shrink-0" />
                      <span>{t("connectAi.installingNotice")}</span>
                    </div>
                  ) : provider.id === "custom" ? (
                    <div className="space-y-2">
                      {isConnecting && (
                        <div
                          role="status"
                          className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300 animate-slide-up"
                        >
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                          <span>{t("connectAi.enterCustomInAgentNotice")}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => onConnect?.(provider.id)}
                        disabled={isConnecting || isChecking}
                        className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer"
                        data-testid={`connect-${provider.id}`}
                      >
                        {isConnecting
                          ? t("connectAi.checking")
                          : t("connectAi.connectAction")}
                      </button>
                    </div>
                  ) : provider.id === "gemini" ? (
                    <div className="space-y-2">
                      {isConnecting && (
                        <div
                          role="status"
                          className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300 animate-slide-up"
                        >
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                          <span>{t("connectAi.enterKeyInAgentNotice")}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onConnect?.(provider.id)}
                          disabled={isConnecting || isChecking}
                          className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer"
                          data-testid={`connect-${provider.id}`}
                        >
                          {isConnecting
                            ? t("connectAi.checking")
                            : t("connectAi.enterKeyAction")}
                        </button>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
                        >
                          {t("connectAi.geminiGetKeyLink")}
                        </a>
                      </div>
                    </div>
                  ) : provider.id === "openrouter" ? (
                    <div className="space-y-2">
                      {isConnecting && (
                        <div
                          role="status"
                          className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300 animate-slide-up"
                        >
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                          <span>{t("connectAi.enterKeyInAgentNotice")}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onConnect?.(provider.id)}
                          disabled={isConnecting || isChecking}
                          className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer"
                        >
                          {isConnecting
                            ? t("connectAi.checking")
                            : t("connectAi.enterKeyAction")}
                        </button>
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2"
                        >
                          {t("connectAi.getFreeKeyLink")}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {isConnecting && (
                        <div
                          role="status"
                          className="flex items-center gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-300 animate-slide-up"
                        >
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                          <span>{t("connectAi.confirmAndSignInNotice")}</span>
                        </div>
                      )}
                      {isConnecting && provider.id === "claude" && (
                        <p className="text-xs text-neutral-400 leading-relaxed">{t("connectAi.claudeConsentNote")}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => onConnect?.(provider.id)}
                        disabled={isConnecting || isChecking}
                        className="inline-flex items-center justify-center rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer"
                      >
                        {isConnecting
                          ? t("connectAi.checking")
                          : !provider.installed
                            ? t("connectAi.installAndSignInAction")
                            : t("connectAi.signInAction")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/40 p-4 space-y-1.5 text-left">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          {t("connectAi.howToConnectTitle")}
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed">
          {t("connectAi.howToConnectDescription")}
        </p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={isChecking}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-neutral-100 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer"
        >
          {isChecking ? t("connectAi.checking") : t("connectAi.checkAgain")}
        </button>
        <a
          href="vibefork://start"
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-neutral-700 bg-transparent px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        >
          {t("connectAi.openAgent")}
        </a>
      </div>
    </div>
  );
}

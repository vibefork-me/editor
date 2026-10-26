import { useState } from "react";
import type { AiProvider } from "../client/types.ts";
import { useI18n } from "../i18n/index.ts";
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
  openrouter: "OpenRouter",
  gemini: "Google AI Studio (Gemini)",
};

/** Providers connected with an API key the person gets on the provider's site. */
const KEY_LINKS: Record<string, { href: string; label: string }> = {
  openrouter: { href: "https://openrouter.ai/keys", label: "connectAi.getFreeKeyLink" },
  gemini: { href: "https://aistudio.google.com/app/apikey", label: "connectAi.geminiGetKeyLink" },
};

/** Groups of the catalog, in order; a provider's group is its `kind`. */
const GROUPS = [
  { kind: "subscription", title: "connectAi.groupSubscription" },
  { kind: "free", title: "connectAi.groupFree" },
  { kind: "custom", title: "connectAi.groupCustom" },
] as const;

/** The search field appears once the catalog is longer than this. */
const SEARCH_FROM = 6;

const primaryButton =
  "inline-flex shrink-0 items-center justify-center rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 disabled:opacity-50 cursor-pointer";
const linkButton =
  "text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 disabled:opacity-50 cursor-pointer";

function Notice({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="mt-2 flex items-center gap-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-300"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-ping" />
      <span>{text}</span>
    </div>
  );
}

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
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const nameOf = (p: AiProvider) =>
    p.id === "custom" ? t("connectAi.optionCustomTitle") : (PROVIDER_NAMES[p.id] ?? p.id);
  const kindLabel = (p: AiProvider) =>
    p.kind === "subscription"
      ? t("connectAi.subscriptionBadge")
      : p.kind === "custom"
        ? t("connectAi.customBadge")
        : t("connectAi.freeBadge");
  const descriptionOf = (p: AiProvider) =>
    p.id === "claude"
      ? t("connectAi.optionSubscriptionDescription")
      : p.id === "codex"
        ? t("connectAi.codexDescription")
        : p.id === "custom"
          ? t("connectAi.optionCustomDescription")
          : p.id === "gemini"
            ? t("connectAi.optionGeminiDescription")
            : t("connectAi.optionOpenRouterDescription");
  const busy = (p: AiProvider) => connectingProvider === p.id || isChecking;

  const connected = list.filter((p) => p.connected === "yes");
  const catalog = list.filter((p) => p.connected !== "yes");
  const q = query.trim().toLowerCase();
  const shown = q
    ? catalog.filter((p) => `${nameOf(p)} ${descriptionOf(p)}`.toLowerCase().includes(q))
    : catalog;

  /** Separate Vibefork sign-in or the user's own (only when the user's CLI is signed in). */
  const modeChoice = (p: AiProvider) =>
    p.userSignedIn ? (
      <div className="mt-2 space-y-2" data-testid={`cli-home-choice-${p.id}`}>
        {(
          [
            ["agent", "connectAi.modeSeparateTitle", "connectAi.modeSeparateDescription", "connectAi.switchToAgentAction"],
            ["user", "connectAi.modeUserTitle", "connectAi.modeUserDescription", "connectAi.switchToUserAction"],
          ] as const
        ).map(([mode, title, description, action]) => {
          const current = mode === "user" ? p.mode === "user" : p.mode !== "user";
          return (
            <div
              key={mode}
              data-testid={`mode-option-${mode}-${p.id}`}
              className={`rounded-md border p-2.5 ${current ? "border-neutral-600 bg-neutral-800/50" : "border-neutral-800 bg-neutral-950/30"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-200">{t(title)}</span>
                {current ? (
                  <span className="text-[10px] font-medium text-emerald-400">✓</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy(p)}
                    onClick={() => onConnect?.(p.id, mode)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                    data-testid={`switch-to-${mode}-${p.id}`}
                  >
                    {t(action)}
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{t(description)}</p>
            </div>
          );
        })}
      </div>
    ) : null;

  const connectingNotice = (p: AiProvider) =>
    connectingProvider !== p.id ? null : (
      <>
        <Notice
          text={t(
            p.id === "custom"
              ? "connectAi.enterCustomInAgentNotice"
              : KEY_LINKS[p.id]
                ? "connectAi.enterKeyInAgentNotice"
                : "connectAi.confirmAndSignInNotice",
          )}
        />
        {p.id === "claude" ? (
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">{t("connectAi.claudeConsentNote")}</p>
        ) : null}
      </>
    );

  const connectLabel = (p: AiProvider) =>
    busy(p) && connectingProvider === p.id
      ? t("connectAi.checking")
      : p.id === "custom"
        ? t("connectAi.connectAction")
        : KEY_LINKS[p.id]
          ? t("connectAi.enterKeyAction")
          : !p.installed
            ? t("connectAi.installAndSignInAction")
            : t("connectAi.signInAction");

  return (
    <div
      className="mx-auto flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-neutral-800 bg-neutral-900/95 text-neutral-100 shadow-xl"
      role="region"
      aria-live="polite"
      aria-label={t("connectAi.title")}
    >
      <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-snug">{t("connectAi.title")}</h2>
          {connected.length === 0 ? (
            <p className="text-xs leading-relaxed text-neutral-400">{t("connectAi.description")}</p>
          ) : null}
        </div>
        <div className="shrink-0">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {connected.length > 0 ? (
          <section className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {t("connectAi.connectedTitle")}
            </h3>
            <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
              {connected.map((p) => (
                <li key={p.id} data-testid={`provider-card-${p.id}`} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="text-sm font-medium">{nameOf(p)}</span>
                    <span className="text-[11px] text-neutral-500">{kindLabel(p)}</span>
                    {p.host ? (
                      <span data-testid={`host-badge-${p.id}`} className="truncate font-mono text-[11px] text-neutral-400">
                        {p.host}
                      </span>
                    ) : null}
                    {p.userSignedIn ? (
                      <span data-testid={`mode-badge-${p.id}`} className="text-[11px] text-neutral-400">
                        {p.mode === "user" ? t("connectAi.modeBadgeUser") : t("connectAi.modeBadgeSeparate")}
                      </span>
                    ) : null}
                    <span className="sr-only">{t("connectAi.connectedBadge")}</span>
                    <span className="ml-auto" />
                    <button
                      type="button"
                      aria-expanded={openActions === p.id}
                      aria-label={t("connectAi.actionsFor", { name: nameOf(p) })}
                      data-testid={`actions-${p.id}`}
                      onClick={() => setOpenActions(openActions === p.id ? null : p.id)}
                      className="rounded px-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 cursor-pointer"
                    >
                      …
                    </button>
                  </div>
                  {openActions === p.id ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {modeChoice(p)}
                      <div className="flex flex-wrap items-center gap-3">
                        {KEY_LINKS[p.id] ? (
                          <button
                            type="button"
                            disabled={busy(p)}
                            onClick={() => onConnect?.(p.id)}
                            className={linkButton}
                            data-testid={`change-${p.id}`}
                          >
                            {t("connectAi.replaceKeyAction")}
                          </button>
                        ) : null}
                        {p.id === "custom" ? (
                          <button
                            type="button"
                            disabled={busy(p)}
                            onClick={() => onConnect?.(p.id)}
                            className={linkButton}
                            data-testid={`change-${p.id}`}
                          >
                            {t("connectAi.changeAction")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy(p)}
                          onClick={() => onDisconnect?.(p.id)}
                          className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                          data-testid={`disconnect-${p.id}`}
                        >
                          {t("connectAi.disconnectAction")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {connectingNotice(p)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {catalog.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              {connected.length > 0 ? t("connectAi.addTitle") : t("connectAi.whatWorksTitle")}
            </h3>
            {catalog.length > SEARCH_FROM ? (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("connectAi.searchPlaceholder")}
                aria-label={t("connectAi.searchPlaceholder")}
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500"
              />
            ) : null}
            {shown.length === 0 ? <p className="text-xs text-neutral-500">{t("connectAi.nothingFound")}</p> : null}
            {GROUPS.map((g) => {
              const items = shown.filter((p) => p.kind === g.kind);
              if (items.length === 0) return null;
              return (
                <div key={g.kind} className="space-y-1">
                  <h4 className="text-[11px] text-neutral-500">{t(g.title)}</h4>
                  <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
                    {items.map((p) => (
                      <li key={p.id} data-testid={`provider-card-${p.id}`} className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{nameOf(p)}</div>
                            <div className="truncate text-xs text-neutral-400">{descriptionOf(p)}</div>
                          </div>
                          {p.installing ? (
                            <span role="status" className="text-xs text-blue-300">
                              {t("connectAi.installingNotice")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy(p)}
                              onClick={() => onConnect?.(p.id)}
                              className={primaryButton}
                              data-testid={`connect-${p.id}`}
                            >
                              {connectLabel(p)}
                            </button>
                          )}
                        </div>
                        {KEY_LINKS[p.id] ? (
                          <a
                            href={KEY_LINKS[p.id].href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
                          >
                            {t(KEY_LINKS[p.id].label as "connectAi.getFreeKeyLink")}
                          </a>
                        ) : null}
                        {modeChoice(p)}
                        {connectingNotice(p)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        ) : null}

        <details className="rounded-lg border border-neutral-800/80 bg-neutral-950/40 px-3 py-2 text-xs text-neutral-400">
          <summary className="cursor-pointer select-none font-medium text-neutral-300">
            {t("connectAi.howToConnectTitle")}
          </summary>
          <p className="mt-1.5 leading-relaxed">{t("connectAi.howToConnectDescription")}</p>
        </details>

        {errorMessage ? (
          <div role="alert" className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-t border-neutral-800 px-5 py-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
        >
          {isChecking ? t("connectAi.checking") : t("connectAi.checkAgain")}
        </button>
        <a href="vibefork://start" className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200">
          {t("connectAi.openAgent")}
        </a>
      </div>
    </div>
  );
}

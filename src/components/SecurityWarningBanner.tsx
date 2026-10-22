import { useState } from "react";

export type SecurityWarningBannerProps = {
  extraOrigins?: string[];
};

export function SecurityWarningBanner({ extraOrigins = [] }: SecurityWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // If no extra origins configured, do not render
  if (!extraOrigins || extraOrigins.length === 0) {
    return null;
  }

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isCurrentOriginExtra = currentOrigin && extraOrigins.includes(currentOrigin);

  if (dismissed) {
    return (
      <div className="bg-amber-950/40 border-b border-amber-500/20 px-6 py-1.5 flex items-center justify-between text-xs text-amber-300/80">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>
            Разрешены сторонние источники ({extraOrigins.length}):{" "}
            <span className="font-mono text-amber-200">{extraOrigins.join(", ")}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="text-amber-400 hover:text-amber-200 underline font-medium text-xs cursor-pointer"
        >
          Показать предупреждение
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-label="Предупреждение безопасности: включены extraOrigins"
      className="bg-amber-950/80 border-b border-amber-500/40 px-6 py-3 text-amber-100 shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5 select-none" aria-hidden="true">
            ⚠️
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-200 text-sm">
                Предупреждение безопасности: активны сторонние веб-источники (extraOrigins)
              </span>
              {isCurrentOriginExtra ? (
                <span className="inline-flex items-center rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  Текущий адрес разрешён
                </span>
              ) : null}
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              Агент Vibefork настроен с дополнительными доверенными адресами:{" "}
              {extraOrigins.map((orig) => (
                <code
                  key={orig}
                  className="rounded bg-amber-900/60 border border-amber-700/50 px-1.5 py-0.5 font-mono text-xs text-amber-100 mx-1"
                >
                  {orig}
                </code>
              ))}
              . Любая веб-страница на этих адресах получает доступ к локальному агенту и вашим проектам.
            </p>

            {showDetails ? (
              <div className="mt-2 rounded-md bg-neutral-950/70 border border-amber-600/30 p-2.5 text-xs text-neutral-300 space-y-1.5">
                <p>
                  <strong className="text-amber-300 font-medium">Безопасность:</strong> Режим extraOrigins
                  предназначен только для локальной разработки (например, Vite dev-сервера на localhost:5173).
                </p>
                <p className="text-neutral-400">
                  Чтобы отключить, удалите поле <code className="text-neutral-200">extraOrigins</code> из{" "}
                  <code className="text-neutral-200">settings.json</code> или очистите переменную окружения{" "}
                  <code className="text-neutral-200">VF_EXTRA_ORIGINS</code> и перезапустите агент.
                </p>
              </div>
            ) : null}

            <div className="pt-0.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-amber-300 hover:text-amber-100 underline cursor-pointer"
              >
                {showDetails ? "Скрыть подробности" : "Подробнее о риске"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-amber-400 hover:text-amber-100 hover:bg-amber-900/50 transition cursor-pointer"
          title="Скрыть предупреждение"
          aria-label="Скрыть предупреждение"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

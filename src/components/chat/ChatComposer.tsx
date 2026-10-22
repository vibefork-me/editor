import type { FormEvent, Ref } from "react";
import { useTranslation } from "../../i18n/i18nStore.ts";

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  statusMessage?: string | null;
  inputRef?: Ref<HTMLTextAreaElement>;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  isSending,
  statusMessage,
  inputRef,
}: ChatComposerProps) {
  const { t } = useTranslation();
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-border bg-surface px-4 py-3">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("project.chatInputLabel")}</span>
        <textarea
          ref={inputRef}
          aria-label={t("project.chatInputLabel")}
          rows={2}
          maxLength={8000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("project.chatPlaceholder")}
          className="block w-full resize-y rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={isSending || !value.trim()}
        className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-surface hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? t("project.sendingMessage") : t("project.sendMessage")}
      </button>
      {statusMessage && <p role="status" className="sr-only">{statusMessage}</p>}
    </form>
  );
}

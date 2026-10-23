import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState, type ReactNode } from "react";
import { useAgentClient } from "../client/react/useAgentClient.ts";
import {
  clearIdentity,
  exportPublicKeyJwk,
  getOrCreateIdentity,
  savePairedKeyId,
} from "../security/browserKeyStore.ts";
import { useTranslation } from "../i18n/i18nStore.ts";
import { useSessionStore } from "../stores/sessionStore.ts";

type PairingPhase = "starting" | "pending" | "denied" | "error" | "ready";

export function PairingGate({ children }: { children: ReactNode }) {
  const client = useAgentClient();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<PairingPhase>("starting");
  const [code, setCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;

    const waitForNextPoll = () =>
      new Promise<void>((resolve) => {
        pollTimer = window.setTimeout(resolve, 900);
      });

    async function pairAndAuthenticate() {
      setPhase("starting");
      setCode(null);
      useSessionStore.getState().setBearerToken(null);
      try {
        let identity = await getOrCreateIdentity();
        if (cancelled) return;
        if (identity.keyId) {
          try {
            const { token } = await client.authenticateSession(identity.keyPair.privateKey);
            useSessionStore.getState().setBearerToken(token);
            if (!cancelled) setPhase("ready");
            return;
          } catch {
            await clearIdentity();
            identity = await getOrCreateIdentity();
          }
        }

        const exported = await exportPublicKeyJwk(identity.keyPair);
        if (cancelled) return;
        if (!exported.kty || !exported.crv || !exported.x || !exported.y) {
          throw new Error("The browser did not export a valid P-256 public key");
        }
        const { pairId, code: pairingCode } = await client.startPairing({
          publicKeyJwk: {
            kty: exported.kty,
            crv: exported.crv,
            x: exported.x,
            y: exported.y,
          },
          name: t("pairing.browserName"),
        });
        if (cancelled) return;
        setCode(pairingCode);
        setPhase("pending");

        while (!cancelled) {
          const status = await client.getPairingStatus(pairId);
          if (status.status === "denied") {
            setPhase("denied");
            return;
          }
          if (status.status === "approved") {
            if (!status.keyId) throw new Error("Approved pairing did not return a key id");
            await savePairedKeyId(status.keyId);
            const { token } = await client.authenticateSession(identity.keyPair.privateKey);
            useSessionStore.getState().setBearerToken(token);
            if (!cancelled) setPhase("ready");
            return;
          }
          await waitForNextPoll();
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    }

    void pairAndAuthenticate();
    return () => {
      cancelled = true;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [attempt, client, t]);

  if (phase === "ready") return <>{children}</>;

  const statusMessage =
    phase === "pending"
      ? t("pairing.pending")
      : phase === "denied"
        ? t("pairing.denied")
        : phase === "error"
          ? t("pairing.error")
          : t("pairing.starting");

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-[101] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface-elevated p-6 text-text shadow-2xl outline-none">
          <Dialog.Title className="text-lg font-semibold">{t("pairing.title")}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-text-muted">
            {t("pairing.description")}
          </Dialog.Description>
          {code && phase === "pending" && (
            <div className="my-5 rounded-lg border border-accent/40 bg-surface px-4 py-3 text-center">
              <p className="text-xs text-text-muted">{t("pairing.codeLabel")}</p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.3em] text-accent" aria-label={t("pairing.codeAccessibleLabel")}>
                {code}
              </p>
            </div>
          )}
          <p role="status" aria-live="polite" className="text-sm text-text-muted">{statusMessage}</p>
          {(phase === "denied" || phase === "error") && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-surface hover:brightness-110"
            >
              {t("pairing.retry")}
            </button>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
/** The code the user types from the agent window: the agent never sends it to the page. */
type CodeState = "idle" | "sending" | "wrong" | "accepted";

export function PairingGate({ children }: { children: ReactNode }) {
  const client = useAgentClient();
  const { t } = useTranslation();
  const [phase, setPhase] = useState<PairingPhase>("starting");
  const [pairId, setPairId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
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
      setPairId(null);
      setCode("");
      setCodeState("idle");
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
        const { pairId } = await client.startPairing({
          publicKeyJwk: {
            kty: exported.kty,
            crv: exported.crv,
            x: exported.x,
            y: exported.y,
          },
          name: t("pairing.browserName"),
        });
        if (cancelled) return;
        setPairId(pairId);
        setPhase("pending");

        while (!cancelled) {
          const status = await client.getPairingStatus(pairId);
          if (status.status === "denied") {
            setPhase("denied");
            return;
          }
          if (status.codeAccepted && !cancelled) setCodeState("accepted");
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

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pairId || codeState === "sending" || codeState === "accepted") return;
    setCodeState("sending");
    try {
      const result = await client.submitPairingCode(pairId, code);
      if (result === null) {
        // An agent without the code step approves on Allow alone; the status poll finishes pairing.
        setCodeState("accepted");
      } else if (result.status === "denied") {
        setPhase("denied");
      } else {
        setCodeState(result.accepted ? "accepted" : "wrong");
      }
    } catch {
      setPhase("error");
    }
  }

  if (phase === "ready") return <>{children}</>;

  const statusMessage =
    phase === "pending"
      ? codeState === "accepted"
        ? t("pairing.codeAccepted")
        : codeState === "wrong"
          ? t("pairing.codeWrong")
          : t("pairing.pending")
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
          {phase === "pending" && codeState !== "accepted" && (
            <form className="my-5 flex items-end gap-3" onSubmit={(event) => void submitCode(event)}>
              <label className="flex-1 text-xs text-text-muted">
                {t("pairing.codeLabel")}
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  autoFocus
                  aria-label={t("pairing.codeAccessibleLabel")}
                  className="mt-1 block w-full rounded-lg border border-accent/40 bg-surface px-3 py-2 text-center font-mono text-2xl font-semibold tracking-[0.3em] text-text outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={code.replace(/\D/g, "").length !== 6 || codeState === "sending"}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-surface hover:brightness-110 disabled:opacity-50"
              >
                {t("pairing.codeSubmit")}
              </button>
            </form>
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

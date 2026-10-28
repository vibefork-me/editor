import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AgentTransport } from "../client/types.ts";
import type { TranslationKey } from "../i18n/types.ts";

/** A project name as the agent keeps it: a plain folder name, `[A-Za-z0-9._-]`, not starting with a dot. */
const PROJECT_NAME_RE = /^(?!\.)[A-Za-z0-9._-]{1,80}$/;

/** Where `?project=<name>` leads: the project, or the start screen with the reason it did not open. */
export type ProjectParamOutcome = { open: string } | { stay: TranslationKey };

/**
 * Checks a project from `?project=`: the agent has it, and this session may open it. Reading its
 * journal asks the person in the agent's window when the session has no access to it yet.
 */
export async function resolveProjectParam(
  client: Pick<AgentTransport, "listProjects" | "getJournal">,
  name: string,
): Promise<ProjectParamOutcome> {
  if (!PROJECT_NAME_RE.test(name)) return { stay: "agentErrors.notFound" };
  let known: boolean;
  try {
    known = (await client.listProjects()).some((p) => p.projectId === name);
  } catch {
    return { stay: "agentErrors.notFound" };
  }
  if (!known) return { stay: "agentErrors.notFound" };
  try {
    await client.getJournal(name);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 403) return { stay: "card.rollbackForbidden" };
    if (status === 404) return { stay: "agentErrors.notFound" };
    // Any other failure is the project page's to show.
  }
  return { open: name };
}

/**
 * Opens the project named by `?project=` (a link from the agent's tray or `vibefork open --project`).
 * The parameter leaves the address bar either way; without it nothing happens.
 * Returns the reason the project did not open, if it did not.
 */
export function useProjectParam(client: Pick<AgentTransport, "listProjects" | "getJournal">): {
  checking: boolean;
  reason: TranslationKey | null;
} {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const name = params.get("project");
  const [reason, setReason] = useState<TranslationKey | null>(null);
  const [checking, setChecking] = useState(name !== null);
  // One check per link: a second run of the effect must not ask the agent again.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (name === null || handled.current === name) return;
    handled.current = name;
    setChecking(true);
    setReason(null);
    void resolveProjectParam(client, name).then((outcome) => {
      if ("open" in outcome) {
        navigate(`/${outcome.open}`, { replace: true });
        return;
      }
      setReason(outcome.stay);
      setChecking(false);
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.delete("project");
          return next;
        },
        { replace: true },
      );
    });
  }, [name, client, navigate, setParams]);

  return { checking, reason };
}

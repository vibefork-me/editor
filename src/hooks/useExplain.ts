import { useCallback, useEffect, useRef, useState } from "react";
import { explainReason, type PersonMessage } from "../canvas/messages/messages.ts";
import { getAgentTransport } from "../stores/agent-bridge.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";

/**
 * "Explain": the agent answers a question about the project, or about one part of its map, in words. Nothing
 * in the project changes and the agent's window asks nothing. The question and the answer come in the session
 * stream; a question the agent did not take stays here, with why, for the conversation.
 */
export function useExplain(projectId: string | null, lang: string) {
  const [explaining, setExplaining] = useState(false);
  const [refused, setRefused] = useState<PersonMessage[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    setRefused([]);
  }, [projectId]);

  const explain = useCallback(
    async (question: string, part?: string) => {
      const transport = getAgentTransport();
      const text = question.trim();
      if (!projectId || !transport || !text || busy.current) return;
      busy.current = true;
      setExplaining(true);
      const at = Date.now();
      const refuse = (code?: string) =>
        setRefused((all) => [
          ...all,
          { id: `e${at}-${all.length}`, text, attachments: [], at, kind: "explain", takenBefore: 0, failed: true, reason: explainReason(code) },
        ]);
      // Once the agent took the question it is on the canvas, with its answer or why there is none.
      let taken = false;
      try {
        const outcome = await transport.explain({ projectId, question: text, part, lang }, (m) => {
          if (m.type !== "canvas") return;
          if (m.ev.type === "question") taken = true;
          useCanvasStore.getState().ingest(m);
        });
        if (outcome.kind === "error" && !taken) refuse(outcome.code);
      } catch {
        if (!taken) refuse();
      } finally {
        busy.current = false;
        setExplaining(false);
      }
    },
    [projectId, lang],
  );

  return { explaining, refused, explain };
}

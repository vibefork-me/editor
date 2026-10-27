import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CanvasPanel } from "../components/canvas/index.ts";
import { ChatComposer } from "../components/chat/ChatComposer.tsx";
import { FeedLineView } from "../components/chat/FeedLineView.tsx";
import { PhaseRail } from "../components/shell/PhaseRail.tsx";
import { StatusBar } from "../components/shell/StatusBar.tsx";
import { ViewerLayoutContainer } from "../components/viewer/index.ts";
import { useProjectShellSync } from "../hooks/useProjectShellSync.ts";
import { useTranslation } from "../i18n/i18nStore.ts";
import { getAgentTransport } from "../stores/agent-bridge.ts";
import { useProjectStore } from "../stores/projectStore.ts";
import { useGraphStore } from "../stores/graphStore.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { feedLine, phaseFromMessage, type FeedLine } from "../client/task-feed.ts";

export function ProjectPage() {
  const { t, locale } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const selectProject = useProjectStore((s) => s.selectProject);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const [chatDraft, setChatDraft] = useState("");
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [smallScreenTab, setSmallScreenTab] = useState<"map" | "chat">("map");
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useCallback(async () => {
    const prompt = chatDraft.trim();
    if (!prompt || !currentProjectId || isSending) return;
    const transport = getAgentTransport();
    if (!transport) {
      setChatStatus(t("project.chatStartFailed"));
      return;
    }
    setIsSending(true);
    setChatStatus(t("project.taskStarted"));
    setChatDraft("");
    setFeed((f) => [...f, { kind: "status", text: `> ${prompt}` }]);
    try {
      // The agent runs the task over its own messages; each one becomes a chat line.
      const outcome = await transport.runTask(
        { projectId: currentProjectId, prompt, lang: locale },
        (m) => {
        if (m.type === "canvas") {
          useCanvasStore.getState().ingest(m);
          return;
        }
        const line = feedLine(m);
        if (line) setFeed((f) => [...f.slice(-499), line]);
        const nextPhase = phaseFromMessage(m);
        if (nextPhase) {
          useGraphStore.getState().setPhase(nextPhase);
        }
        if (m.type === "step-done" || m.type === "done") {
          void useGraphStore.getState().refreshGraph();
        }
      });
      if (outcome.kind === "done") {
        useGraphStore.getState().setPhase("done");
        void useGraphStore.getState().refreshGraph();
      }
      setChatStatus(
        outcome.kind === "done" && outcome.code === 0
          ? t("project.taskDone")
          : outcome.kind === "cancelled"
            ? t("project.taskCancelled")
            : t("project.taskFailed"),
      );
    } catch {
      setChatStatus(t("project.chatStartFailed"));
    } finally {
      setIsSending(false);
    }
  }, [chatDraft, currentProjectId, isSending, t]);

  const handleAskAbout = useCallback((prefix: string) => {
    setChatDraft(prefix);
    setChatStatus(null);
    chatInputRef.current?.focus();
  }, []);

  useProjectShellSync();

  useEffect(() => {
    if (!projectId) return;
    if (projectId !== currentProjectId) {
      void selectProject(projectId);
    } else {
      void useGraphStore.getState().loadGraph(projectId);
    }
  }, [projectId, currentProjectId, selectProject]);

  // The session stream of the project: what the agent did so far, then live events of a task.
  useEffect(() => {
    if (projectId) void useCanvasStore.getState().open(projectId);
  }, [projectId]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-surface font-sans text-text">
      <StatusBar />
      <PhaseRail />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav aria-label={t("project.workspaceTabs")} className="flex shrink-0 border-b border-border lg:hidden">
          <button type="button" aria-pressed={smallScreenTab === "map"} onClick={() => setSmallScreenTab("map")} className="flex-1 px-4 py-2 text-sm aria-pressed:text-accent">
            {t("project.mapTab")}
          </button>
          <button type="button" aria-pressed={smallScreenTab === "chat"} onClick={() => setSmallScreenTab("chat")} className="flex-1 px-4 py-2 text-sm aria-pressed:text-accent">
            {t("project.chatTab")}
          </button>
        </nav>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section aria-label={t("project.mapTab")} className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden ${smallScreenTab === "chat" ? "hidden lg:flex" : "flex"}`}>
            <CanvasPanel onAskAbout={handleAskAbout} />
            <ViewerLayoutContainer />
          </section>
          <aside aria-label={t("project.chatTab")} className={`flex min-h-0 w-full shrink-0 flex-col border-l border-border bg-surface lg:w-[360px] min-[1280px]:w-[400px] ${smallScreenTab === "map" ? "hidden lg:flex" : "flex"}`}>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1.5 text-sm" aria-live="polite" data-testid="task-feed">
              {feed.map((line, i) => (
                <FeedLineView key={i} line={line} />
              ))}
            </div>
            <ChatComposer
              value={chatDraft}
              onChange={setChatDraft}
              onSend={() => void sendMessage()}
              isSending={isSending}
              statusMessage={chatStatus}
              inputRef={chatInputRef}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

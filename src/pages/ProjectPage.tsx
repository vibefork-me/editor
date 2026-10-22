import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CanvasPanel } from "../components/canvas/index.ts";
import { ChatComposer } from "../components/chat/ChatComposer.tsx";
import { PhaseRail } from "../components/shell/PhaseRail.tsx";
import { StatusBar } from "../components/shell/StatusBar.tsx";
import { ViewerLayoutContainer } from "../components/viewer/index.ts";
import { useProjectShellSync } from "../hooks/useProjectShellSync.ts";
import { useTranslation } from "../i18n/i18nStore.ts";
import { getAgentTransport } from "../stores/agent-bridge.ts";
import { useProjectStore } from "../stores/projectStore.ts";
import { useTaskStore } from "../stores/taskStore.ts";

export function ProjectPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const selectProject = useProjectStore((s) => s.selectProject);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const [chatDraft, setChatDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
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
    setChatStatus(null);
    try {
      const { taskId } = await transport.startTask({ projectId: currentProjectId, prompt });
      useTaskStore.getState().setActiveTask(taskId);
      setChatDraft("");
      setChatStatus(t("project.taskStarted"));
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
    if (!projectId || projectId === currentProjectId) return;
    void selectProject(projectId);
  }, [projectId, currentProjectId, selectProject]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-surface font-sans text-text">
      <StatusBar />
      <PhaseRail />
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden relative">
        <CanvasPanel onAskAbout={handleAskAbout} />
        <ViewerLayoutContainer />
      </div>
      <ChatComposer
        value={chatDraft}
        onChange={setChatDraft}
        onSend={() => void sendMessage()}
        isSending={isSending}
        statusMessage={chatStatus}
        inputRef={chatInputRef}
      />
    </div>
  );
}

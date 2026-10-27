import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CanvasPanel } from "../components/canvas/index.ts";
import { ChatComposer } from "../components/chat/ChatComposer.tsx";
import { FeedLineView } from "../components/chat/FeedLineView.tsx";
import { PhaseRail } from "../components/shell/PhaseRail.tsx";
import { StageRail, useNow } from "../canvas/rail/StageRail.tsx";
import { StopBanner } from "../canvas/rail/StopBanner.tsx";
import { PartCallout, PartPanel, type PartActions } from "../canvas/card/PartCard.tsx";
import { TaskLayer } from "../canvas/task/TaskLayer.tsx";
import type { GraphApi } from "../canvas/graph/GraphCanvas.tsx";
import { useViewerStore } from "../stores/viewerStore.ts";
import type { NoteAttachment, TaskControl } from "../client/types.ts";
import { MessagesDock } from "../canvas/messages/MessagesDock.tsx";
import { NoteCapsule } from "../canvas/messages/NoteCapsule.tsx";
import { conversation, markNotDelivered, promptWithText, waitingCount, type PersonMessage } from "../canvas/messages/messages.ts";
import { StatusBar } from "../components/shell/StatusBar.tsx";
import { ViewerLayoutContainer } from "../components/viewer/index.ts";
import { useProjectShellSync } from "../hooks/useProjectShellSync.ts";
import { useTranslation } from "../i18n/i18nStore.ts";
import { getAgentTransport } from "../stores/agent-bridge.ts";
import { useProjectStore } from "../stores/projectStore.ts";
import { useGraphStore } from "../stores/graphStore.ts";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { isCanvasStreamEnabled } from "../flags.ts";

// The living map of the session stream; loaded on demand, it is not part of the first screen.
const GraphCanvas = lazy(() => import("../canvas/graph/GraphCanvas.tsx").then((m) => ({ default: m.GraphCanvas })));
import { feedLine, phaseFromMessage, type FeedLine } from "../client/task-feed.ts";
import type { Offer, ServerMessage } from "../client/protocol.generated.ts";

// Errors of `choose_offer` that mean the offer did not start: an older agent, or stale offers.
const OFFER_NOT_STARTED = new Set(["not_supported", "no_offers", "bad_index"]);

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
  const canvas = useCanvasStore((s) => s.canvas);
  const hasStream = isCanvasStreamEnabled() && canvas.order.length > 0;
  const now = useNow();
  // The part the person opened on the canvas: its card next to the node, or the panel with everything.
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [partPanel, setPartPanel] = useState(false);
  const [graphApi, setGraphApi] = useState<GraphApi | null>(null);
  // How to pause, resume or cancel the running task; null when none runs.
  const [taskControl, setTaskControl] = useState<TaskControl | null>(null);
  // What the person wrote to the agent on the canvas, this visit.
  const [messages, setMessages] = useState<PersonMessage[]>([]);

  // `offer`: the task is what an offer of the analysis suggests; the agent takes its text itself.
  const startTask = useCallback(async (prompt: string, offer?: { index: number; title: string }) => {
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
      const onMessage = (m: ServerMessage) => {
        // The agent did not take a note (it has no notes yet): the person sees it was not delivered.
        if (m.type === "error" && m.code === "not_supported") {
          setMessages(markNotDelivered);
          return;
        }
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
      };
      const outcome = offer
        ? await transport.runOffer({ projectId: currentProjectId, index: offer.index, title: offer.title, lang: locale }, onMessage, setTaskControl)
        : await transport.runTask({ projectId: currentProjectId, prompt, lang: locale }, onMessage, setTaskControl);
      // The offer did not start (an older agent, or the offers changed): its text goes into the field.
      if (offer && outcome.kind === "error" && outcome.code && OFFER_NOT_STARTED.has(outcome.code)) {
        setChatDraft(prompt);
        setChatStatus(t("project.offerInField"));
        chatInputRef.current?.focus();
        return;
      }
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
      setTaskControl(null);
    }
  }, [currentProjectId, isSending, t, locale]);

  const sendMessage = useCallback(() => void startTask(chatDraft.trim()), [chatDraft, startTask]);

  // The field on the canvas: a note to the running task, or a new task.
  const sendFromCanvas = useCallback(
    (text: string, attachments: NoteAttachment[]) => {
      if (isSending && !taskControl) return;
      const message: PersonMessage = {
        id: `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        attachments: attachments.map((a) => a.name),
        at: Date.now(),
        kind: taskControl ? "note" : "task",
        takenBefore: canvas.notesTaken.length,
      };
      setMessages((all) => [...all, message]);
      setChatDraft("");
      if (taskControl) taskControl.note(text, attachments);
      else void startTask(promptWithText(text, attachments));
    },
    [isSending, taskControl, canvas.notesTaken.length, startTask],
  );
  // An offer of the analysis: starts its task when none runs, otherwise its text goes into the field.
  const chooseOffer = useCallback(
    (index: number, offer: Offer) => {
      const prompt = offer.text ? `${offer.title}\n\n${offer.text}` : offer.title;
      if (isSending || taskControl) {
        setChatDraft(offer.text);
        chatInputRef.current?.focus();
        return;
      }
      setMessages((all) => [
        ...all,
        { id: `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: offer.title, attachments: [], at: Date.now(), kind: "task", takenBefore: canvas.notesTaken.length },
      ]);
      void startTask(prompt, { index, title: offer.title });
    },
    [isSending, taskControl, canvas.notesTaken.length, startTask],
  );
  const waitingNotes = waitingCount(conversation(messages, canvas.notesTaken));

  const handleAskAbout = useCallback((prefix: string) => {
    setChatDraft(prefix);
    setChatStatus(null);
    chatInputRef.current?.focus();
  }, []);

  const partActions: PartActions = {
    onAsk: handleAskAbout,
    onShowChanges: (file) => void useViewerStore.getState().openDiff(file.path),
    onOpenFile: (path) => void useViewerStore.getState().openFile(path),
    onGoTo: (id) => {
      setSelectedPart(id);
      graphApi?.centerOn(id);
    },
    onClose: () => {
      setSelectedPart(null);
      setPartPanel(false);
    },
  };

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
      {hasStream ? null : <PhaseRail />}
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
            {hasStream ? (
              <Suspense fallback={null}>
                <GraphCanvas
                  state={canvas}
                  selectedId={selectedPart}
                  onSelect={(id) => {
                    setSelectedPart(id);
                    setPartPanel(false);
                  }}
                  onReady={setGraphApi}
                />
                {selectedPart && !partPanel && (
                  <PartCallout state={canvas} nodeId={selectedPart} api={graphApi} onMore={() => setPartPanel(true)} {...partActions} />
                )}
                {selectedPart && partPanel && <PartPanel state={canvas} nodeId={selectedPart} {...partActions} />}
                <TaskLayer state={canvas} />
                <div className="pointer-events-none absolute inset-x-4 top-4 z-10">
                  <StageRail state={canvas} now={now} onStop={taskControl ? () => taskControl.stop() : undefined} />
                </div>
                <NoteCapsule api={graphApi} nodeId={canvas.focusedId} count={waitingNotes} />
                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
                  <MessagesDock
                    state={canvas}
                    running={taskControl !== null}
                    messages={messages}
                    draft={chatDraft}
                    onDraftChange={setChatDraft}
                    onSend={sendFromCanvas}
                    onChooseOffer={chooseOffer}
                    onGoTo={partActions.onGoTo}
                    inputRef={chatInputRef}
                  >
                    {canvas.paused && taskControl && (
                      <div className="flex justify-center">
                        <StopBanner onResume={() => taskControl.resume()} onCancel={() => taskControl.cancel()} />
                      </div>
                    )}
                  </MessagesDock>
                </div>
              </Suspense>
            ) : (
              <CanvasPanel onAskAbout={handleAskAbout} />
            )}
            <ViewerLayoutContainer />
          </section>
          <aside aria-label={t("project.chatTab")} className={`flex min-h-0 w-full shrink-0 flex-col border-l border-border bg-surface lg:w-[360px] min-[1280px]:w-[400px] ${smallScreenTab === "map" ? "hidden lg:flex" : "flex"}`}>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1.5 text-sm" aria-live="polite" data-testid="task-feed">
              {feed.map((line, i) => (
                <FeedLineView key={i} line={line} />
              ))}
            </div>
            {/* With the living canvas the field is on the canvas. */}
            {!hasStream && (
              <ChatComposer
                value={chatDraft}
                onChange={setChatDraft}
                onSend={sendMessage}
                isSending={isSending}
                statusMessage={chatStatus}
                inputRef={chatInputRef}
              />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { CanvasPanel } from "../components/canvas/index.ts";
import { ChatComposer } from "../components/chat/ChatComposer.tsx";
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
import { ViewerLayoutContainer } from "../components/viewer/index.ts";
import { ProjectMenu } from "../components/workspace/ProjectMenu.tsx";
import { PanelToggles, PANEL_NAMES } from "../components/workspace/PanelToggles.tsx";
import { HelpButton } from "../components/workspace/HelpButton.tsx";
import { ResizeHandle } from "../components/workspace/ResizeHandle.tsx";
import { FilesPanel } from "../components/workspace/FilesPanel.tsx";
import { JournalPanel, journalErrors } from "../components/workspace/JournalPanel.tsx";
import { partOfFile } from "../components/workspace/files.ts";
import { IconClose } from "../components/workspace/icons.tsx";
import { useLayoutStore, type PanelId } from "../stores/layoutStore.ts";
import { useBuildStore } from "../stores/buildStore.ts";
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const panels = useLayoutStore((s) => s.panels);
  const setPanelOpen = useLayoutStore((s) => s.setOpen);
  const activePath = useViewerStore((s) => s.activePath);
  const buildFailed = useBuildStore((s) => s.status === "failed");
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

  // A file opened from the map, the card or Files shows in the code panel.
  useEffect(() => {
    if (activePath) setPanelOpen("code", true);
  }, [activePath, setPanelOpen]);

  const errors = journalErrors(feed, buildFailed, canvas);
  const partId = activePath ? partOfFile(canvas, activePath) : null;
  const label = (id: string) => canvas.nodes[id]?.label ?? id;

  /** A panel at an edge: a title with its close button, and what it shows. */
  const panelFrame = (id: PanelId, body: ReactNode) => {
    const name = t(PANEL_NAMES[id]);
    return (
      <section aria-label={name} data-testid={`panel-${id}`} className="flex h-full min-h-0 w-full min-w-0 flex-col bg-surface">
        <div className="flex h-9 shrink-0 items-center border-b border-border bg-surface-elevated px-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{name}</span>
          <button
            type="button"
            aria-label={t("workspace.closePanel", { name })}
            onClick={() => setPanelOpen(id, false)}
            className="ml-auto flex size-6 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-text"
          >
            <IconClose className="size-3.5" />
          </button>
        </div>
        {body}
      </section>
    );
  };

  return (
    <div className="flex h-dvh w-full flex-none overflow-hidden bg-surface font-sans text-text" data-testid="workspace">
      {panels.files.open && (
        <>
          <div className="flex shrink-0" style={{ width: panels.files.size }}>
            {panelFrame("files", <FilesPanel state={canvas} partLabel={label} />)}
          </div>
          <ResizeHandle panel="files" edge="right" label={t("workspace.resizePanel", { name: t("workspace.filesPanel") })} />
        </>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <section aria-label={t("project.mapTab")} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!hasStream && <PhaseRail />}
          <div className="relative min-h-0 flex-1">
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
                <TaskLayer state={canvas} history={historyOpen} onHistoryChange={setHistoryOpen} />
                <div className="pointer-events-none absolute inset-x-4 top-16 z-10">
                  <StageRail state={canvas} now={now} onStop={taskControl ? () => taskControl.stop() : undefined} />
                </div>
                <NoteCapsule api={graphApi} nodeId={canvas.focusedId} count={waitingNotes} />
                <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-16">
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
            {/* Islands in the corners: the project with its menu and the panel buttons; help. */}
            <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-2">
              <ProjectMenu onHistory={canvas.history.length > 0 ? () => setHistoryOpen(true) : undefined} />
              <PanelToggles journalError={errors.agent || errors.build || errors.program} />
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 z-30">
              <HelpButton />
            </div>
          </div>
          {/* Until the living canvas shows the map, the field is under it. */}
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
        </section>
        {panels.journal.open && (
          <>
            <ResizeHandle panel="journal" edge="top" label={t("workspace.resizePanel", { name: t("workspace.journalPanel") })} />
            <div className="flex shrink-0" style={{ height: panels.journal.size }}>
              <JournalPanel feed={feed} taskStatus={chatStatus} state={canvas} errors={errors} />
            </div>
          </>
        )}
      </div>
      {panels.code.open && (
        <>
          <ResizeHandle panel="code" edge="left" label={t("workspace.resizePanel", { name: t("workspace.codePanel") })} />
          <div className="flex shrink-0" style={{ width: panels.code.size }}>
            {panelFrame(
              "code",
              activePath ? (
                <ViewerLayoutContainer part={partId ? { label: label(partId), onGoTo: () => partActions.onGoTo(partId) } : null} />
              ) : (
                <p className="p-4 text-sm text-text-muted">{t("code.empty")}</p>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}

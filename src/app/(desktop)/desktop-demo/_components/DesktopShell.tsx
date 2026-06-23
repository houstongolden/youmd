"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { PRIMARY_NAV, PROJECTS, FILE_CONTENT, TASKS, CHATS, SESSIONS, destinationForView, type Task, type ChatThread, type ViewId, type AgentSession } from "../_data/mock";
import { useIsMobile } from "../_lib/useIsMobile";
import { useSwipe } from "../_lib/useSwipe";
import { useTheme } from "../_lib/useTheme";
import { cn } from "../_lib/cn";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { SessionShell } from "./SessionShell";
import { ResizeHandle } from "./ResizeHandle";
import { useRealData } from "../_lib/RealDataContext";
import { type AgentAction, type ChatScope } from "./ChatPanel";
import { SummaryWidget } from "./SummaryWidget";
import { CommandPalette, type Command } from "./CommandPalette";
import { Inspector } from "./Inspector";
import { SegmentedHeader } from "./primitives";
import { useToast } from "./Toast";
import { HomeView } from "./views/HomeView";
import { EditorView } from "./views/EditorView";
import { ProjectsView } from "./views/ProjectsView";
import { GraphView } from "./views/GraphView";
import { TasksView } from "./views/TasksView";
import { SkillsView } from "./views/SkillsView";
import { AppsView } from "./views/AppsView";
import { AgentsView } from "./views/AgentsView";
import { LoopsView } from "./views/LoopsView";
import { TerminalView } from "./views/TerminalView";
import { ProvisionView } from "./views/ProvisionView";
import { SyncView } from "./views/SyncView";
import { LiveLogView } from "./views/LiveLogView";

function MainView({
  view,
  onNavigate,
  editorFile,
  onEditorSelect,
  selectedProject,
  onProjectSelect,
  tasks,
  onAdvanceTask,
  selectedNode,
  onSelectNode,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  editorFile: string;
  onEditorSelect: (id: string) => void;
  selectedProject: string;
  onProjectSelect: (slug: string) => void;
  tasks: Task[];
  onAdvanceTask: (id: string) => void;
  selectedNode: string | null;
  onSelectNode: (id: string) => void;
}) {
  switch (view) {
    case "home":
      return <HomeView onNavigate={onNavigate} tasks={tasks} />;
    case "editor":
      return <EditorView activeId={editorFile} onSelect={onEditorSelect} />;
    case "projects":
      return <ProjectsView selected={selectedProject} onSelect={onProjectSelect} onNavigate={onNavigate} tasks={tasks} />;
    case "graph":
      return <GraphView selectedNode={selectedNode} onSelectNode={onSelectNode} />;
    case "tasks":
      return <TasksView tasks={tasks} onAdvance={onAdvanceTask} />;
    case "skills":
      return <SkillsView />;
    case "apps":
      return <AppsView />;
    case "agents":
      return <AgentsView />;
    case "loops":
      return <LoopsView />;
    case "terminal":
      return <TerminalView />;
    case "provision":
      return <ProvisionView />;
    case "sync":
      return <SyncView />;
    case "livelog":
      return <LiveLogView />;
  }
}

// Mobile-only bottom bar: swap between the conversation and the active
// workspace view (the desktop split is collapsed into a single column).
export function DesktopShell() {
  const isMobile = useIsMobile();
  // Live sessions from the real SessionSource (agent bus + local) when available.
  const real = useRealData();
  const sessions = real?.sessions?.length ? (real.sessions as AgentSession[]) : SESSIONS;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop rail
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile off-canvas
  const [chatFull, setChatFull] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [mobilePane, setMobilePane] = useState<"chat" | "view">("chat");
  const [editorFile, setEditorFile] = useState("identity/you.md");
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0].slug);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Unified shell: which agent session is active (persists = "last used"), and
  // whether the shell docks on the left or right.
  const [activeSessionId, setActiveSessionId] = useState(sessions[0].id);
  const [chatSide, setChatSide] = useState<"left" | "right">("left");
  const [shellOpen, setShellOpen] = useState(true); // show/hide the whole sessions/shell pane
  const [railCollapsed, setRailCollapsed] = useState(false); // collapse just the session list
  const [shellWidth, setShellWidth] = useState(468);
  const [inspectorWidth, setInspectorWidth] = useState(304);
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [chats, setChats] = useState<ChatThread[]>(CHATS);
  const [activeChat, setActiveChat] = useState(CHATS[0].id);
  const { theme, toggle: toggleTheme } = useTheme();
  const toast = useToast();

  const focusChatPane = () => {
    if (isMobile) {
      setMobilePane("chat");
      setDrawerOpen(false);
    }
  };
  const selectChat = (id: string) => {
    setActiveChat(id);
    focusChatPane();
  };
  const newChat = () => {
    const id = `new-${Date.now()}`;
    setChats((c) => [{ id, title: "New chat", at: "now" }, ...c]);
    setActiveChat(id);
    focusChatPane();
  };
  const activeChatTitle = chats.find((c) => c.id === activeChat)?.title;

  // Switch the unified shell to a session (local chat/terminal or remote watch).
  const selectSession = (s: AgentSession) => {
    setActiveSessionId(s.id);
    focusChatPane();
  };
  const newSession = (project: string) => toast(`New agent on ${project} — pick a model to spawn…`, "agent");

  const addTask = (title: string, project: string, owner: Task["owner"] = "you") =>
    setTasks((t) => [
      { id: `t${Date.now()}`, title, owner, status: "open", priority: "med", project },
      ...t,
    ]);

  const advanceTask = (id: string) =>
    setTasks((ts) =>
      ts.map((t) => {
        if (t.id !== id) return t;
        const order: Task["status"][] = ["open", "in_progress", "done"];
        return { ...t, status: order[(order.indexOf(t.status) + 1) % order.length] };
      }),
    );

  // Real effects behind the contextual chat chips — the "light-touch
  // direction" layer actually doing something + giving feedback.
  const onAgentAction = (action: AgentAction, scope?: ChatScope) => {
    switch (action) {
      case "promote-task":
        addTask("Follow up on the idea you promoted", "you.md", "you");
        toast("Added to Tasks — open · you.md", "check");
        break;
      case "spawn":
        toast(`Spawning a YOU sub-agent${scope?.project ? ` on ${scope.project}` : ""}…`, "agent");
        break;
      case "sync":
        toast("Syncing all machines…", "sync");
        break;
      case "forge-skill":
        toast("Forging a new skill from your patterns…", "layers");
        break;
      case "improve-skill":
        toast("Improving a skill from recent usage…", "sparkles");
        break;
    }
  };

  const navigate = (v: ViewId) => {
    setActiveView(v);
    if (isMobile) {
      setMobilePane("view");
      setDrawerOpen(false);
    } else if (chatFull) {
      // Jumping to a workspace view from full-chat returns to split.
      setChatFull(false);
    }
  };

  const openNote = (id: string) => {
    setEditorFile(id);
    navigate("editor");
  };
  // Cross-pillar: open a project's repo overview in the Vault from a session.
  const openInVault = (project: string) => openNote(`project:${project}`);
  const connectProvider = (provider: string) => toast(`Connecting ${provider} cloud — authorize to run + watch cloud agents…`, "sync");

  const openProject = (slug: string) => {
    setSelectedProject(slug);
    navigate("projects");
  };

  // Clicking a graph node opens the inspector on that entity (and syncs the
  // selected project when the node is a project we know).
  const selectNode = (id: string) => {
    setSelectedNode(id);
    const asProject = PROJECTS.find((p) => p.slug === id);
    if (asProject) setSelectedProject(asProject.slug);
    setInspectorOpen(true);
  };

  // The destination (rail entry) that owns the active segment, + its segments.
  const activeDestination = destinationForView(activeView);

  // Workspace = optional segmented header + scrollable view + optional inspector.
  const renderWorkspace = (withInspector: boolean) => (
    <div className="flex h-full min-w-0 flex-col">
      {activeDestination.segments.length > 1 && (
        <SegmentedHeader
          segments={activeDestination.segments}
          active={activeView}
          onSelect={(id) => navigate(id as ViewId)}
        />
      )}
      <div className="flex min-h-0 flex-1">
        <motion.div
          key={activeView}
          className="h-full min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--bg))]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <MainView
            view={activeView}
            onNavigate={navigate}
            editorFile={editorFile}
            onEditorSelect={setEditorFile}
            selectedProject={selectedProject}
            onProjectSelect={setSelectedProject}
            tasks={tasks}
            onAdvanceTask={advanceTask}
            selectedNode={selectedNode}
            onSelectNode={selectNode}
          />
        </motion.div>
        {withInspector && inspectorOpen && (
          <>
            <ResizeHandle width={inspectorWidth} setWidth={setInspectorWidth} min={248} max={480} side="left" />
            <div style={{ width: inspectorWidth }} className="shrink-0">
              <Inspector
                view={activeView}
                selectedProject={selectedProject}
                selectedNode={selectedNode}
                onClose={() => setInspectorOpen(false)}
                onNavigate={navigate}
                onOpenNote={openNote}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // What the chat agent is "looking at" with you — the active context scope.
  const chatScope = useMemo(() => {
    if (activeView === "projects") {
      const p = PROJECTS.find((x) => x.slug === selectedProject);
      return { view: "projects", label: p?.name ?? "Projects", project: p?.name };
    }
    if (activeView === "editor") return { view: "editor", label: editorFile.split("/").pop() ?? "Brain" };
    const item = PRIMARY_NAV.find((n) => n.id === activeView);
    return { view: activeView, label: item?.label ?? "you.md" };
  }, [activeView, selectedProject, editorFile]);

  // ⌘K / Ctrl+K toggles the command palette anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The whole product surface as a flat command list for the palette.
  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = PRIMARY_NAV.map((n) => ({
      id: `nav:${n.id}`,
      label: `Go to ${n.label}`,
      group: "Navigate",
      icon: n.icon,
      run: () => navigate(n.id),
    }));

    const notes: Command[] = Object.keys(FILE_CONTENT).map((id) => ({
      id: `note:${id}`,
      label: id.split("/").pop() ?? id,
      group: "Notes",
      icon: "file",
      hint: id.includes("/") ? id.split("/").slice(0, -1).join("/") : undefined,
      keywords: id,
      run: () => openNote(id),
    }));

    const projects: Command[] = PROJECTS.map((p) => ({
      id: `project:${p.slug}`,
      label: `Open project: ${p.name}`,
      group: "Projects",
      icon: "branch",
      keywords: p.slug,
      run: () => openProject(p.slug),
    }));

    const actions: Command[] = [
      {
        id: "action:spawn",
        label: "Spawn a YOU sub-agent",
        group: "Actions",
        icon: "sparkles",
        run: () => navigate("agents"),
      },
      {
        id: "action:theme",
        label: "Toggle light / dark theme",
        group: "Actions",
        icon: "sparkles",
        keywords: "appearance mode color",
        run: toggleTheme,
      },
      {
        id: "action:focus-chat",
        label: chatFull ? "Exit full-chat (split view)" : "Focus chat (full width)",
        group: "Actions",
        icon: "chat",
        keywords: "layout split focus conversation",
        run: () => (isMobile ? setMobilePane("chat") : setChatFull((f) => !f)),
      },
    ];

    return [...nav, ...notes, ...projects, ...actions];
    // navigate/openNote are stable enough for the demo; rebuild on layout flags.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFull, isMobile]);

  const toggleSidebar = () => {
    if (isMobile) setDrawerOpen((o) => !o);
    else setSidebarCollapsed((c) => !c);
  };

  // Edge-swipe right opens the drawer; swipe left closes it.
  const workspaceSwipe = useSwipe({
    edgeOnly: 32,
    onSwipeRight: () => setDrawerOpen(true),
    onSwipeLeft: () => setDrawerOpen(false),
  });
  const drawerSwipe = useSwipe({ onSwipeLeft: () => setDrawerOpen(false) });

  const title = isMobile
    ? mobilePane === "chat"
      ? "Chat"
      : PRIMARY_NAV.find((n) => n.id === activeView)?.label ?? ""
    : chatFull
      ? "Chat"
      : PRIMARY_NAV.find((n) => n.id === activeView)?.label ?? "";

  return (
    <div className="flex h-full w-full flex-col">
      <TitleBar
        title={title}
        isMobile={isMobile}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        chatFull={chatFull}
        onToggleChatFull={() => setChatFull((f) => !f)}
        onOpenCommand={() => setPaletteOpen(true)}
        mobileOnView={isMobile && mobilePane === "view"}
        onGoToChat={() => setMobilePane("chat")}
        inspectorOpen={inspectorOpen}
        onToggleInspector={chatFull ? undefined : () => setInspectorOpen((o) => !o)}
        chatSide={chatSide}
        onFlipSide={() => setChatSide((s) => (s === "left" ? "right" : "left"))}
        shellOpen={shellOpen}
        onToggleShell={() => setShellOpen((o) => !o)}
      />

      <div className="relative flex min-h-0 flex-1">
        {isMobile ? (
          <>
            {/* Off-canvas drawer + backdrop */}
            {drawerOpen && (
              <button
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 z-20 bg-black/50"
              />
            )}
            <div
              {...drawerSwipe}
              className={cn(
                "absolute inset-y-0 left-0 z-30 w-64 max-w-[82%] shadow-2xl transition-transform duration-200",
                drawerOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <Sidebar
                collapsed={false}
                activeView={activeView}
                onNavigate={navigate}
                theme={theme}
                onToggleTheme={toggleTheme}
                onOpenStatus={() => navigate("sync")}
                chats={chats}
                activeChat={activeChat}
                onSelectChat={selectChat}
                onNewChat={newChat}
              />
            </div>

            {/* Single-column workspace */}
            <div {...workspaceSwipe} className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                {mobilePane === "chat" ? (
                  <SessionShell
                    full
                    sessions={sessions}
                    activeId={activeSessionId}
                    onSelect={selectSession}
                    onNew={newSession}
                    onOpenInVault={openInVault}
                    onConnect={connectProvider}
                    showRail={false}
                    scope={chatScope}
                    onAction={onAgentAction}
                    chatId={activeChat}
                    chatTitle={activeChatTitle}
                  />
                ) : (
                  renderWorkspace(false)
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <Sidebar
              collapsed={sidebarCollapsed}
              activeView={activeView}
              onNavigate={navigate}
              theme={theme}
              onToggleTheme={toggleTheme}
              onOpenStatus={() => navigate("sync")}
              chats={chats}
              activeChat={activeChat}
              onSelectChat={selectChat}
              onNewChat={newChat}
            />

            {chatFull ? (
              // Full-chat: chat fills the workspace, summary widget floats.
              <div className="relative min-w-0 flex-1">
                <SessionShell
                  full
                  sessions={sessions}
                  activeId={activeSessionId}
                  onSelect={selectSession}
                  onNew={newSession}
                  onOpenInVault={openInVault}
                  onConnect={connectProvider}
                  scope={chatScope}
                  onAction={onAgentAction}
                  chatId={activeChat}
                  chatTitle={activeChatTitle}
                />
                <div className="pointer-events-none absolute right-5 top-4">
                  <div className="pointer-events-auto">
                    <SummaryWidget />
                  </div>
                </div>
              </div>
            ) : (
              // Split: chat 1/3 left, main view 2/3 right.
              <div className="flex min-w-0 flex-1">
                {shellOpen && chatSide === "left" && (
                  <>
                    <div style={{ width: shellWidth }} className="flex shrink-0 flex-col">
                      <SessionShell
                        sessions={sessions}
                        activeId={activeSessionId}
                        onSelect={selectSession}
                        onNew={newSession}
                        onOpenInVault={openInVault}
                        onConnect={connectProvider}
                        showRail={!railCollapsed}
                        onToggleRail={() => setRailCollapsed((c) => !c)}
                        scope={chatScope}
                        onAction={onAgentAction}
                        chatId={activeChat}
                        chatTitle={activeChatTitle}
                      />
                    </div>
                    <ResizeHandle width={shellWidth} setWidth={setShellWidth} min={360} max={760} side="right" />
                  </>
                )}
                <main className="min-w-0 flex-1 overflow-hidden bg-[hsl(var(--bg))]">
                  {renderWorkspace(true)}
                </main>
                {shellOpen && chatSide === "right" && (
                  <>
                    <ResizeHandle width={shellWidth} setWidth={setShellWidth} min={360} max={760} side="left" />
                    <div style={{ width: shellWidth }} className="flex shrink-0 flex-col">
                      <SessionShell
                        sessions={sessions}
                        activeId={activeSessionId}
                        onSelect={selectSession}
                        onNew={newSession}
                        onOpenInVault={openInVault}
                        onConnect={connectProvider}
                        showRail={!railCollapsed}
                        onToggleRail={() => setRailCollapsed((c) => !c)}
                        scope={chatScope}
                        onAction={onAgentAction}
                        chatId={activeChat}
                        chatTitle={activeChatTitle}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

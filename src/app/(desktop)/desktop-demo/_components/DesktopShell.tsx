"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { PRIMARY_NAV, PROJECTS, FILE_CONTENT, TASKS, type Task, type ViewId } from "../_data/mock";
import { useIsMobile } from "../_lib/useIsMobile";
import { useSwipe } from "../_lib/useSwipe";
import { useTheme } from "../_lib/useTheme";
import { cn } from "../_lib/cn";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { ChatPanel, type AgentAction, type ChatScope } from "./ChatPanel";
import { SummaryWidget } from "./SummaryWidget";
import { CommandPalette, type Command } from "./CommandPalette";
import { SystemStatus } from "./SystemStatus";
import { useToast } from "./Toast";
import { Icon } from "./icons";
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

function MainView({
  view,
  onNavigate,
  editorFile,
  onEditorSelect,
  selectedProject,
  onProjectSelect,
  tasks,
  onAdvanceTask,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  editorFile: string;
  onEditorSelect: (id: string) => void;
  selectedProject: string;
  onProjectSelect: (slug: string) => void;
  tasks: Task[];
  onAdvanceTask: (id: string) => void;
}) {
  switch (view) {
    case "home":
      return <HomeView onNavigate={onNavigate} tasks={tasks} />;
    case "editor":
      return <EditorView activeId={editorFile} onSelect={onEditorSelect} />;
    case "projects":
      return <ProjectsView selected={selectedProject} onSelect={onProjectSelect} onNavigate={onNavigate} tasks={tasks} />;
    case "graph":
      return <GraphView />;
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
  }
}

// Mobile-only bottom bar: swap between the conversation and the active
// workspace view (the desktop split is collapsed into a single column).
function MobileTabBar({
  pane,
  activeView,
  onSelect,
}: {
  pane: "chat" | "view";
  activeView: ViewId;
  onSelect: (p: "chat" | "view") => void;
}) {
  const viewMeta = PRIMARY_NAV.find((n) => n.id === activeView);
  const tabs = [
    { id: "chat" as const, label: "Chat", icon: "chat" as const },
    { id: "view" as const, label: viewMeta?.label ?? "Workspace", icon: viewMeta?.icon ?? ("home" as const) },
  ];
  return (
    <nav className="flex shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--bg))] pb-[env(safe-area-inset-bottom)]">
      {tabs.map((t) => {
        const active = pane === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              active ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]",
            )}
          >
            <Icon name={t.icon} size={18} />
            <span className="font-mono text-[10px] uppercase tracking-wider">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function DesktopShell() {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop rail
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile off-canvas
  const [chatFull, setChatFull] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [mobilePane, setMobilePane] = useState<"chat" | "view">("chat");
  const [editorFile, setEditorFile] = useState("identity/you.md");
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0].slug);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const { theme, toggle: toggleTheme } = useTheme();
  const toast = useToast();

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

  const openProject = (slug: string) => {
    setSelectedProject(slug);
    navigate("projects");
  };

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
                onOpenStatus={() => setStatusOpen(true)}
              />
            </div>

            {/* Single-column workspace */}
            <div {...workspaceSwipe} className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                {mobilePane === "chat" ? (
                  <ChatPanel full scope={chatScope} onAction={onAgentAction} />
                ) : (
                  <motion.div
                    key={activeView}
                    className="h-full overflow-y-auto bg-[hsl(var(--bg))]"
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
                    />
                  </motion.div>
                )}
              </div>
              <MobileTabBar pane={mobilePane} activeView={activeView} onSelect={setMobilePane} />
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
              onOpenStatus={() => setStatusOpen(true)}
            />

            {chatFull ? (
              // Full-chat: chat fills the workspace, summary widget floats.
              <div className="relative min-w-0 flex-1">
                <ChatPanel full scope={chatScope} onAction={onAgentAction} />
                <div className="pointer-events-none absolute right-5 top-4">
                  <div className="pointer-events-auto">
                    <SummaryWidget />
                  </div>
                </div>
              </div>
            ) : (
              // Split: chat 1/3 left, main view 2/3 right.
              <div className="flex min-w-0 flex-1">
                <div className="flex w-[33%] min-w-[320px] max-w-[460px] flex-col border-r border-[hsl(var(--border))]">
                  <ChatPanel scope={chatScope} onAction={onAgentAction} />
                </div>
                <main className="min-w-0 flex-1 overflow-hidden bg-[hsl(var(--bg))]">
                  <motion.div
                    key={activeView}
                    className="h-full overflow-y-auto"
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
                    />
                  </motion.div>
                </main>
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
      <SystemStatus open={statusOpen} onClose={() => setStatusOpen(false)} />
    </div>
  );
}

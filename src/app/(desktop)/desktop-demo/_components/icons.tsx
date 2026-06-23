"use client";

// Thin wrapper over lucide-react so the rest of the demo references stable
// semantic names (and we stay consistent / emoji-free per the brand rules).
import {
  House,
  FileText,
  Share2,
  CircleCheck,
  Plug,
  Bot,
  SquareTerminal,
  Github,
  Hash,
  AtSign,
  Mail,
  Search,
  Settings,
  Plus,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  SlidersHorizontal,
  MessagesSquare,
  Maximize2,
  Columns2,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Folder,
  FolderOpen,
  ArrowUp,
  Sparkles,
  Circle,
  GitBranch,
  Boxes,
  Sun,
  Moon,
  BrainCircuit,
  Layers,
  Laptop,
  RefreshCw,
  Repeat,
  Workflow,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const MAP = {
  home: House,
  file: FileText,
  graph: Share2,
  check: CircleCheck,
  plug: Plug,
  agent: Bot,
  terminal: SquareTerminal,
  github: Github,
  slack: Hash,
  at: AtSign,
  mail: Mail,
  search: Search,
  settings: Settings,
  plus: Plus,
  panelOpen: PanelLeft,
  panelClose: PanelLeftClose,
  panelRight: PanelRight,
  sliders: SlidersHorizontal,
  chat: MessagesSquare,
  expand: Maximize2,
  split: Columns2,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  chevronsLeft: ChevronsLeft,
  chevronsRight: ChevronsRight,
  menu: Menu,
  close: X,
  folder: Folder,
  folderOpen: FolderOpen,
  send: ArrowUp,
  sparkles: Sparkles,
  dot: Circle,
  branch: GitBranch,
  stack: Boxes,
  sun: Sun,
  moon: Moon,
  brain: BrainCircuit,
  layers: Layers,
  device: Laptop,
  sync: RefreshCw,
  loop: Repeat,
  workflow: Workflow,
  logout: LogOut,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof MAP;

export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = MAP[name];
  return <Cmp size={size} className={className} strokeWidth={strokeWidth} />;
}

import type { CSSProperties } from "react";
import {
  Activity,
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  ClipboardCopy,
  Code2,
  Database,
  Download,
  FileCode2,
  Filter,
  Files,
  FolderPlus,
  GitBranch,
  History,
  Keyboard,
  ListCollapse,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Pencil,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Search,
  SearchCheck,
  Settings2,
  Sparkles,
  Sun,
  Table2,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  activity: Activity,
  "arrow-left": ChevronLeft,
  "arrow-right": ChevronRight,
  braces: Braces,
  check: Check,
  "chevrons-left": ChevronsLeft,
  "chevrons-right": ChevronsRight,
  cluster: Activity,
  code: Code2,
  copy: ClipboardCopy,
  database: Database,
  docs: Files,
  download: Download,
  "folder-plus": FolderPlus,
  filter: Filter,
  github: GitBranch,
  history: History,
  indexes: Database,
  keyboard: Keyboard,
  mapping: Braces,
  moon: Moon,
  "more-horizontal": MoreHorizontal,
  "panel-left": PanelLeft,
  "panel-right": PanelRight,
  pencil: Pencil,
  play: Play,
  plug: Plug,
  plus: Plus,
  query: FileCode2,
  "quick-query": SearchCheck,
  refresh: RefreshCw,
  rows: ListCollapse,
  save: Save,
  search: Search,
  settings: Settings2,
  sparkles: Sparkles,
  status: CircleDot,
  sun: Sun,
  table: Table2,
  trash: Trash2,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

export function Icon({ name, size = 15, style, className }: Props) {
  const Component = ICONS[name];
  return <Component size={size} strokeWidth={1.8} style={{ flex: "none", ...style }} className={className} aria-hidden />;
}

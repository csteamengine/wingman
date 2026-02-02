import { useState, useRef, useEffect, useMemo } from 'react';
import {
  // Text & Typography
  Type,
  CaseSensitive,
  CaseUpper,
  CaseLower,
  ALargeSmall,
  Baseline,
  Subscript,
  Superscript,
  Pilcrow,
  TextCursor,
  TextCursorInput,
  Quote,
  TextQuote,
  Heading1,
  Heading2,
  Heading3,

  // Code & Development
  Code,
  Code2,
  CodeXml,
  Braces,
  Brackets,
  Terminal,
  TerminalSquare,
  FileCode,
  FileCode2,
  FileJson,
  FileJson2,
  FileType,
  FileType2,
  Bug,
  Regex,
  Binary,
  Variable,
  SquareFunction,
  FunctionSquare,

  // Transformation & Processing
  Wand2,
  Sparkles,
  Zap,
  RefreshCw,
  RefreshCcw,
  RotateCw,
  RotateCcw,
  Replace,
  ReplaceAll,
  Shuffle,
  ArrowRightLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowDownUp,
  MoveHorizontal,
  MoveVertical,
  Repeat,
  Repeat1,
  Repeat2,
  Redo,
  Redo2,
  Undo,
  Undo2,
  FlipHorizontal,
  FlipHorizontal2,
  FlipVertical,
  FlipVertical2,

  // Sorting & Organizing
  SortAsc,
  SortDesc,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUpZA,
  ArrowDown01,
  ArrowUp01,
  ArrowDown10,
  ArrowUp10,
  ListOrdered,
  List,
  ListChecks,
  ListFilter,
  ListTree,
  ListX,
  ListMinus,
  ListPlus,
  Filter,
  FilterX,

  // Alignment & Layout
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignCenterHorizontal,
  WrapText,
  Indent,
  IndentDecrease,
  IndentIncrease,

  // Files & Documents
  File,
  FileText,
  FilePlus,
  FileMinus,
  FileX,
  FileCheck,
  FileInput,
  FileOutput,
  FileDiff,
  FileSearch,
  FileEdit,
  FileSpreadsheet,
  Files,
  Folder,
  FolderOpen,

  // Editing & Tools
  Scissors,
  Copy,
  ClipboardCopy,
  ClipboardPaste,
  ClipboardList,
  ClipboardCheck,
  Eraser,
  Pencil,
  PencilLine,
  PenLine,
  PenTool,
  Highlighter,
  Edit,
  Edit2,
  Edit3,
  Trash,
  Trash2,

  // Math & Numbers
  Hash,
  Plus,
  Minus,
  X,
  Divide,
  Equal,
  Percent,
  Calculator,
  Sigma,
  Pi,
  Infinity,

  // Arrows & Navigation
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,

  // Data & Analytics
  BarChart,
  BarChart2,
  BarChart3,
  BarChart4,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Activity,

  // Communication & Web
  Link,
  Link2,
  Unlink,
  Unlink2,
  ExternalLink,
  Globe,
  Globe2,
  Mail,
  AtSign,

  // Security & Privacy
  Lock,
  Unlock,
  Key,
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
  EyeOff,

  // Media & Images
  Image,
  ImagePlus,
  ImageMinus,
  Camera,
  Video,
  Music,
  Volume2,
  VolumeX,

  // Status & Feedback
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  XCircle,
  XSquare,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  CircleDot,
  Circle,

  // Time & Date
  Clock,
  Clock1,
  Clock2,
  Clock3,
  Clock4,
  Timer,
  TimerOff,
  Hourglass,
  Calendar,
  CalendarDays,

  // Shapes & Objects
  Square,
  Circle as CircleIcon,
  Triangle,
  Hexagon,
  Octagon,
  Star,
  Heart,
  Bookmark,
  Tag,
  Tags,
  Flag,

  // Misc & Special
  Sparkle,
  Sun,
  Moon,
  Cloud,
  Flame,
  Snowflake,
  Droplet,
  Leaf,
  TreeDeciduous,
  Flower2,

  // Tools & Settings
  Settings,
  Settings2,
  Wrench,
  Hammer,
  SlidersHorizontal,
  SlidersVertical,
  Gauge,
  Cog,

  // Containers & Boxes
  Box,
  Package,
  Archive,
  Database,
  HardDrive,
  Server,

  // People & Users
  User,
  UserPlus,
  UserMinus,
  Users,

  // Misc useful
  Command,
  Option,
  Power,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Maximize2,
  Minimize2,
  Expand,
  Shrink,
  Move,
  Grip,
  GripVertical,
  GripHorizontal,
  MoreHorizontal,
  MoreVertical,
  Menu,

} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icon map for dynamic rendering - organized by category
const ICON_MAP: Record<string, LucideIcon> = {
  // Text & Typography
  Type,
  CaseSensitive,
  CaseUpper,
  CaseLower,
  ALargeSmall,
  Baseline,
  Subscript,
  Superscript,
  Pilcrow,
  TextCursor,
  TextCursorInput,
  Quote,
  TextQuote,
  Heading1,
  Heading2,
  Heading3,

  // Code & Development
  Code,
  Code2,
  CodeXml,
  Braces,
  Brackets,
  Terminal,
  TerminalSquare,
  FileCode,
  FileCode2,
  FileJson,
  FileJson2,
  FileType,
  FileType2,
  Bug,
  Regex,
  Binary,
  Variable,
  SquareFunction,
  FunctionSquare,

  // Transformation & Processing
  Wand2,
  Sparkles,
  Zap,
  RefreshCw,
  RefreshCcw,
  RotateCw,
  RotateCcw,
  Replace,
  ReplaceAll,
  Shuffle,
  ArrowRightLeft,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowDownUp,
  MoveHorizontal,
  MoveVertical,
  Repeat,
  Repeat1,
  Repeat2,
  Redo,
  Redo2,
  Undo,
  Undo2,
  FlipHorizontal,
  FlipHorizontal2,
  FlipVertical,
  FlipVertical2,

  // Sorting & Organizing
  SortAsc,
  SortDesc,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUpZA,
  ArrowDown01,
  ArrowUp01,
  ArrowDown10,
  ArrowUp10,
  ListOrdered,
  List,
  ListChecks,
  ListFilter,
  ListTree,
  ListX,
  ListMinus,
  ListPlus,
  Filter,
  FilterX,

  // Alignment & Layout
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  AlignStartVertical,
  AlignEndVertical,
  AlignCenterVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignCenterHorizontal,
  WrapText,
  Indent,
  IndentDecrease,
  IndentIncrease,

  // Files & Documents
  File,
  FileText,
  FilePlus,
  FileMinus,
  FileX,
  FileCheck,
  FileInput,
  FileOutput,
  FileDiff,
  FileSearch,
  FileEdit,
  FileSpreadsheet,
  Files,
  Folder,
  FolderOpen,

  // Editing & Tools
  Scissors,
  Copy,
  ClipboardCopy,
  ClipboardPaste,
  ClipboardList,
  ClipboardCheck,
  Eraser,
  Pencil,
  PencilLine,
  PenLine,
  PenTool,
  Highlighter,
  Edit,
  Edit2,
  Edit3,
  Trash,
  Trash2,

  // Math & Numbers
  Hash,
  Plus,
  Minus,
  X,
  Divide,
  Equal,
  Percent,
  Calculator,
  Sigma,
  Pi,
  Infinity,

  // Arrows & Navigation
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  MoveUp,
  MoveDown,
  MoveLeft,
  MoveRight,

  // Data & Analytics
  BarChart,
  BarChart2,
  BarChart3,
  BarChart4,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Activity,

  // Communication & Web
  Link,
  Link2,
  Unlink,
  Unlink2,
  ExternalLink,
  Globe,
  Globe2,
  Mail,
  AtSign,

  // Security & Privacy
  Lock,
  Unlock,
  Key,
  KeyRound,
  Shield,
  ShieldCheck,
  ShieldX,
  Eye,
  EyeOff,

  // Media & Images
  Image,
  ImagePlus,
  ImageMinus,
  Camera,
  Video,
  Music,
  Volume2,
  VolumeX,

  // Status & Feedback
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  XCircle,
  XSquare,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  CircleDot,
  Circle: CircleIcon,

  // Time & Date
  Clock,
  Clock1,
  Clock2,
  Clock3,
  Clock4,
  Timer,
  TimerOff,
  Hourglass,
  Calendar,
  CalendarDays,

  // Shapes & Objects
  Square,
  Triangle,
  Hexagon,
  Octagon,
  Star,
  Heart,
  Bookmark,
  Tag,
  Tags,
  Flag,

  // Misc & Special
  Sparkle,
  Sun,
  Moon,
  Cloud,
  Flame,
  Snowflake,
  Droplet,
  Leaf,
  TreeDeciduous,
  Flower2,

  // Tools & Settings
  Settings,
  Settings2,
  Wrench,
  Hammer,
  SlidersHorizontal,
  SlidersVertical,
  Gauge,
  Cog,

  // Containers & Boxes
  Box,
  Package,
  Archive,
  Database,
  HardDrive,
  Server,

  // People & Users
  User,
  UserPlus,
  UserMinus,
  Users,

  // Misc useful
  Command,
  Option,
  Power,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Maximize2,
  Minimize2,
  Expand,
  Shrink,
  Move,
  Grip,
  GripVertical,
  GripHorizontal,
  MoreHorizontal,
  MoreVertical,
  Menu,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Wand2;
}

// Convert camelCase/PascalCase to space-separated words for search
function iconNameToSearchTerms(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1 ')
    .toLowerCase();
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const SelectedIcon = getIconComponent(value);

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return AVAILABLE_ICONS;
    const searchLower = search.toLowerCase();
    return AVAILABLE_ICONS.filter((name) => {
      const searchTerms = iconNameToSearchTerms(name);
      return name.toLowerCase().includes(searchLower) || searchTerms.includes(searchLower);
    });
  }, [search]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-hover)] transition-colors"
        title="Select icon"
      >
        <SelectedIcon className="w-5 h-5 text-[var(--ui-text)]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-md shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-[var(--ui-border)]">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full px-2 py-1.5 text-sm bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)]"
            />
          </div>

          {/* Icon grid */}
          <div className="p-2 max-h-64 overflow-y-auto">
            {filteredIcons.length === 0 ? (
              <p className="text-xs text-[var(--ui-text-muted)] text-center py-4">No icons found</p>
            ) : (
              <div className="grid grid-cols-8 gap-1 w-[280px]">
                {filteredIcons.map((iconName) => {
                  const Icon = ICON_MAP[iconName];
                  const isSelected = value === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => {
                        onChange(iconName);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                        isSelected
                          ? 'bg-[var(--ui-accent)] text-white'
                          : 'hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                      }`}
                      title={iconName}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Count footer */}
          <div className="px-2 py-1.5 border-t border-[var(--ui-border)] text-[10px] text-[var(--ui-text-muted)]">
            {filteredIcons.length} of {AVAILABLE_ICONS.length} icons
          </div>
        </div>
      )}
    </div>
  );
}

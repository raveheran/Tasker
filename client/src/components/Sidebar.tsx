import {
  LayoutDashboard,
  ListTodo,
  Inbox,
  Sun,
  BookOpen,
  StickyNote,
  Tag,
  Archive,
  Gauge,
  FileText,
  ClipboardList,
  Activity,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { GlobalSearch } from '@/components/GlobalSearch';
import type { SpaceName } from '@/types';

interface NavItem {
  name: string;
  space: SpaceName;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', space: 'dashboard', icon: LayoutDashboard },
  { name: 'Tasks', space: 'tasks', icon: ListTodo },
  { name: 'Backlog', space: 'backlog', icon: Inbox },
  { name: 'My Day', space: 'my-day', icon: Sun },
  { name: 'User Stories', space: 'user-stories', icon: BookOpen },
  { name: 'Notes', space: 'notes', icon: StickyNote },
  { name: 'Labels', space: 'labels', icon: Tag },
  { name: 'Archive', space: 'archive', icon: Archive },
  { name: 'Sprint Overview', space: 'sprint-overview', icon: Gauge },
  { name: 'Work Summary', space: 'work-summary', icon: ClipboardList },
  { name: 'Templates', space: 'templates', icon: FileText },
  { name: 'Activity', space: 'activity', icon: Activity },
];

const bottomItems: NavItem[] = [
  { name: 'Settings', space: 'settings', icon: Settings },
];

export function Sidebar() {
  const { activeSpace, setActiveSpace } = useUIStore();

  return (
    <aside className="w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-5 w-5" />
          Tasker
        </h1>
      </div>

      {/* Search */}
      <div className="px-2 pt-2">
        <GlobalSearch />
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.space}
            onClick={() => setActiveSpace(item.space)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
              activeSpace === item.space
                ? 'bg-sidebar-accent text-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.name}
          </button>
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-2 px-2 border-t border-sidebar-border">
        {bottomItems.map((item) => (
          <button
            key={item.space}
            onClick={() => setActiveSpace(item.space)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left',
              activeSpace === item.space
                ? 'bg-sidebar-accent text-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.name}
          </button>
        ))}
      </div>
    </aside>
  );
}

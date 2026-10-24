import { Sidebar } from '@/components/Sidebar';
import { TasksSpace } from '@/components/TasksSpace';
import { BacklogSpace } from '@/components/BacklogSpace';
import { MyDaySpace } from '@/components/MyDaySpace';
import { UserStoriesSpace } from '@/components/UserStoriesSpace';
import { SprintOverviewSpace } from '@/components/SprintOverviewSpace';
import { NotesSpace } from '@/components/NotesSpace';
import { DashboardSpace } from '@/components/DashboardSpace';
import { ArchiveSpace } from '@/components/ArchiveSpace';
import { LabelsSpace } from '@/components/LabelsSpace';
import { TemplatesSpace } from '@/components/TemplatesSpace';
import { ActivityPage } from '@/components/ActivityPage';
import { WorkSummarySpace } from '@/components/WorkSummarySpace';
import { TaskDetail } from '@/components/TaskDetail';
import { QuickAdd } from '@/components/QuickAdd';
import { SettingsPage } from '@/components/SettingsPage';
import { PlaceholderPage } from '@/components/PlaceholderPage';
import { ConnectionGuard } from '@/components/ConnectionGuard';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/store';

function MainContent() {
  const { activeSpace } = useUIStore();

  switch (activeSpace) {
    case 'dashboard':
      return <DashboardSpace />;
    case 'tasks':
      return <TasksSpace />;
    case 'backlog':
      return <BacklogSpace />;
    case 'my-day':
      return <MyDaySpace />;
    case 'user-stories':
      return <UserStoriesSpace />;
    case 'sprint-overview':
      return <SprintOverviewSpace />;
    case 'notes':
      return <NotesSpace />;
    case 'labels':
      return <LabelsSpace />;
    case 'archive':
      return <ArchiveSpace />;
    case 'templates':
      return <TemplatesSpace />;
    case 'activity':
      return <ActivityPage />;
    case 'work-summary':
      return <WorkSummarySpace />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <PlaceholderPage space={activeSpace} />;
  }
}

export default function App() {
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen bg-background text-foreground dark overflow-hidden">
      <ConnectionGuard />
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <MainContent />
      </main>
      <TaskDetail />
      <QuickAdd />
    </div>
  );
}

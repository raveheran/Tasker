// ── Domain Types ──

export interface Status {
  id: number;
  name: string;
  phase: 'planning' | 'execution' | 'any';
  color: string;
  sort_order: number;
}

export interface Sprint {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  is_hidden: number;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_completed: number;
  sort_order: number;
}

export interface Task {
  id: number;
  title: string;
  status_id: number;
  user_story_id: number | null;
  do_date: string | null;
  start_date: string | null;
  end_date: string | null;
  sprint_id: number | null;
  effort_estimate: number | null;
  details: string | null;
  requires_other: number;
  requires_other_note: string | null;
  is_quick: number;
  is_priority: number;
  recurrence_rule: string | null;
  recurrence_parent_id: number | null;
  color_override: string | null;
  is_archived: number;
  my_day_order: number | null;
  kanban_order: number | null;
  template_origin_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  labels: Label[];
  subtasks: Subtask[];
}

export interface UserStory {
  id: number;
  title: string;
  status_id: number;
  sprint_id: number | null;
  details: string | null;
  color_override: string | null;
  is_archived: number;
  template_origin_id: number | null;
  created_at: string;
  updated_at: string;
  labels: Label[];
  // joined fields
  status_name?: string;
  status_phase?: string;
  status_color?: string;
  task_count?: number;
  active_task_count?: number;
  tasks?: Task[];
}

export interface Note {
  id: number;
  title: string;
  content: string | null;
  sprint_id: number | null;
  parent_id: number | null;
  sort_order: number;
  template_origin_id: number | null;
  created_at: string;
  updated_at: string;
  labels: Label[];
}

export interface Template {
  id: number;
  name: string;
  description: string | null;
  details_content: string | null;
  subtasks_json: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

// ── API Params ──

export interface TaskFilters {
  is_archived?: number;
  status_id?: number;
  sprint_id?: number;
  label_id?: number;
  search?: string;
  status_phase?: string;
  do_date_from?: string;
  do_date_to?: string;
  has_do_date?: boolean;
}

export type TaskCreateInput = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'labels' | 'subtasks'>> & {
  title: string;
  label_ids?: number[];
  subtasks?: string[];
};

export type TaskUpdateInput = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'labels' | 'subtasks'>> & {
  label_ids?: number[];
};

// ── User Story API Params ──

export interface UserStoryFilters {
  is_archived?: number;
  status_id?: number;
  sprint_id?: number;
  label_id?: number;
  search?: string;
  status_phase?: string;
}

export type UserStoryCreateInput = {
  title: string;
  status_id?: number;
  sprint_id?: number | null;
  details?: string;
  color_override?: string | null;
  label_ids?: number[];
};

export type UserStoryUpdateInput = Partial<Omit<UserStory, 'id' | 'created_at' | 'updated_at' | 'labels' | 'tasks'>> & {
  label_ids?: number[];
};

export interface LinkedNote {
  id: number;
  title: string;
  updated_at: string;
}

// ── Note API Params ──

export interface NoteFilters {
  sprint_id?: number;
  label_id?: number;
  search?: string;
}

export type NoteCreateInput = {
  title: string;
  content?: string;
  sprint_id?: number | null;
  parent_id?: number | null;
  label_ids?: number[];
};

export type NoteUpdateInput = Partial<Omit<Note, 'id' | 'created_at' | 'updated_at' | 'labels'>> & {
  label_ids?: number[];
};

// ── View Types ──

export type SpaceName =
  | 'dashboard'
  | 'tasks'
  | 'backlog'
  | 'my-day'
  | 'user-stories'
  | 'notes'
  | 'labels'
  | 'archive'
  | 'sprint-overview'
  | 'work-summary'
  | 'templates'
  | 'activity'
  | 'settings';

export type TaskViewMode = 'table' | 'kanban' | 'timeline' | 'calendar' | 'week';

export interface LinkedTask {
  id: number;
  title: string;
  status_id: number;
  status_name: string;
  status_color: string;
  status_phase: string;
}

// ── Dashboard Types ──

export interface DashboardStatusCount {
  id: number;
  name: string;
  color: string;
  phase: string;
  sort_order: number;
  count: number;
}

export interface DashboardSprintStats {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  total_tasks: number;
  done_tasks: number;
  total_effort: number;
  done_effort: number;
}

export interface DashboardRecentTask {
  id: number;
  title: string;
  updated_at: string;
  status_name: string;
  status_color: string;
  labels: { name: string; color: string }[];
}

export interface DashboardLabelCount {
  name: string;
  color: string;
  count: number;
}

// ── Activity Log ──

export interface ActivityEntry {
  id: number;
  entity_type: 'task' | 'user_story' | 'note';
  entity_id: number;
  action: string;
  details: string | null;
  created_at: string;
}

export interface DashboardData {
  tasksByStatus: DashboardStatusCount[];
  tasksByPhase: { phase: string; count: number }[];
  tasksByLabel: DashboardLabelCount[];
  totalTasks: number;
  dueToday: number;
  overdue: number;
  doneTasks: number;
  activeSprint: DashboardSprintStats | null;
  recentTasks: DashboardRecentTask[];
  totalStories: number;
  totalNotes: number;
}

// ── Search Types ──

export interface SearchResults {
  tasks: {
    id: number;
    title: string;
    details: string | null;
    do_date: string | null;
    is_archived: number;
    status_name: string;
    status_color: string;
  }[];
  userStories: {
    id: number;
    title: string;
    details: string | null;
    is_archived: number;
    status_name: string;
    status_color: string;
  }[];
  notes: {
    id: number;
    title: string;
    content: string | null;
    updated_at: string;
  }[];
}

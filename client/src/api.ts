import type {
  Task, TaskFilters, TaskCreateInput, TaskUpdateInput,
  Status, Sprint, Label, Template, Subtask,
  UserStory, UserStoryFilters, UserStoryCreateInput, UserStoryUpdateInput,
  Note, NoteFilters, NoteCreateInput, NoteUpdateInput,
  DashboardData, SearchResults, LinkedTask, LinkedNote, ActivityEntry, Workspace,
} from './types';
import { workspaceHeaders, handleWorkspaceGone } from './lib/workspace';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...workspaceHeaders(), ...options?.headers },
    });
  } catch {
    throw new Error('Cannot reach the server. Your changes may not be saved.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (err.code === 'WORKSPACE_NOT_FOUND') handleWorkspaceGone();
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export interface HealthResult {
  /** Server reachable and answering */
  online: boolean;
  /** Set when the server is up but this tab's workspace cannot be opened (missing/corrupt database) */
  workspaceError?: string;
}

// Health check
export async function checkHealth(): Promise<HealthResult> {
  try {
    const res = await fetch(`${BASE}/health`, { headers: workspaceHeaders(), signal: AbortSignal.timeout(5000) });
    if (res.ok) return { online: true };
    const body = await res.json().catch(() => ({}));
    if (body.code === 'WORKSPACE_NOT_FOUND') {
      handleWorkspaceGone();
      return { online: true };
    }
    if (body.code === 'WORKSPACE_UNAVAILABLE') return { online: true, workspaceError: body.error };
    return { online: false };
  } catch {
    return { online: false };
  }
}

// ── Workspaces ──

export const workspacesApi = {
  list: (withStats = false) => request<Workspace[]>(`/workspaces${withStats ? '?stats=1' : ''}`),
  create: (name: string) =>
    request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
  rename: (id: string, name: string) =>
    request<Workspace>(`/workspaces/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  delete: (id: string, confirmName: string) =>
    request<{ success: boolean; trashed_to: string | null }>(`/workspaces/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm_name: confirmName }),
    }),
};

// ── Tasks ──

export const tasksApi = {
  list: (filters: TaskFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return request<Task[]>(`/tasks${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<Task>(`/tasks/${id}`),
  create: (data: TaskCreateInput) =>
    request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: TaskUpdateInput) =>
    request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  duplicate: (id: number) =>
    request<Task>(`/tasks/${id}/duplicate`, { method: 'POST' }),

  // Subtasks
  addSubtask: (taskId: number, title: string) =>
    request<Subtask>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
  updateSubtask: (taskId: number, subtaskId: number, data: Partial<Subtask>) =>
    request<Subtask>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSubtask: (taskId: number, subtaskId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }),
  reorderSubtasks: (taskId: number, order: number[]) =>
    request<Subtask[]>(`/tasks/${taskId}/subtasks-order`, { method: 'PUT', body: JSON.stringify({ order }) }),

  // My Day
  addToMyDay: (taskId: number) =>
    request<Task>(`/tasks/my-day/${taskId}`, { method: 'POST' }),
  removeFromMyDay: (taskId: number) =>
    request<{ success: boolean }>(`/tasks/my-day/${taskId}`, { method: 'DELETE' }),
  reorderMyDay: (order: number[]) =>
    request<{ success: boolean }>('/tasks/my-day/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
  reorderKanban: (order: number[]) =>
    request<{ success: boolean }>('/tasks/kanban/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
  workSummary: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/tasks/work-summary?${qs}`);
  },
};

// ── Statuses ──

export const statusesApi = {
  list: () => request<Status[]>('/statuses'),
  create: (data: Partial<Status>) =>
    request<Status>('/statuses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Status>) =>
    request<Status>(`/statuses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reorder: (order: number[]) =>
    request<Status[]>('/statuses/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/statuses/${id}`, { method: 'DELETE' }),
};

// ── Sprints ──

export const sprintsApi = {
  list: () => request<Sprint[]>('/sprints'),
  get: (id: number) => request<Sprint>(`/sprints/${id}`),
  create: (data: Partial<Sprint>) =>
    request<Sprint>('/sprints', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Sprint>) =>
    request<Sprint>(`/sprints/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  activate: (id: number) =>
    request<Sprint>(`/sprints/${id}/activate`, { method: 'POST' }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/sprints/${id}`, { method: 'DELETE' }),
};

// ── Labels ──

export const labelsApi = {
  list: () => request<Label[]>('/labels'),
  create: (data: Partial<Label>) =>
    request<Label>('/labels', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Label>) =>
    request<Label>(`/labels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/labels/${id}`, { method: 'DELETE' }),
};

// ── Templates ──

export const templatesApi = {
  list: () => request<Template[]>('/templates'),
  get: (id: number) => request<Template>(`/templates/${id}`),
  create: (data: Partial<Template>) =>
    request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Template>) =>
    request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
  applyToTask: (templateId: number, taskId: number) =>
    request<Task>(`/templates/${templateId}/apply/${taskId}`, { method: 'POST' }),
  createFromTemplate: (templateId: number, data?: { status_id?: number; sprint_id?: number }) =>
    request<Task>(`/templates/${templateId}/create-task`, { method: 'POST', body: JSON.stringify(data || {}) }),
  createNoteFromTemplate: (templateId: number, data?: { sprint_id?: number; parent_id?: number | null }) =>
    request<Note>(`/templates/${templateId}/create-note`, { method: 'POST', body: JSON.stringify(data || {}) }),
};

// ── User Stories ──

export const userStoriesApi = {
  list: (filters: UserStoryFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return request<UserStory[]>(`/user-stories${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<UserStory>(`/user-stories/${id}`),
  create: (data: UserStoryCreateInput) =>
    request<UserStory>('/user-stories', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: UserStoryUpdateInput) =>
    request<UserStory>(`/user-stories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/user-stories/${id}`, { method: 'DELETE' }),
};

// ── Notes ──

export const notesApi = {
  list: (filters: NoteFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return request<Note[]>(`/notes${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<Note>(`/notes/${id}`),
  create: (data: NoteCreateInput) =>
    request<Note>('/notes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: NoteUpdateInput) =>
    request<Note>(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
  reorder: (items: { id: number; parent_id: number | null; sort_order: number }[]) =>
    request<{ success: boolean }>('/notes/reorder/batch', { method: 'PUT', body: JSON.stringify({ items }) }),
  // Note-Task links (from note side)
  getLinkedTasks: (noteId: number) => request<LinkedTask[]>(`/notes/${noteId}/linked-tasks`),
  addTaskLink: (noteId: number, taskId: number) =>
    request<{ success: boolean }>(`/notes/${noteId}/linked-tasks`, { method: 'POST', body: JSON.stringify({ task_id: taskId }) }),
  removeTaskLink: (noteId: number, taskId: number) =>
    request<{ success: boolean }>(`/notes/${noteId}/linked-tasks/${taskId}`, { method: 'DELETE' }),
};

// ── Dashboard ──

export const dashboardApi = {
  get: (params?: { sprint_id?: number; date_from?: string; date_to?: string }) => {
    const parts: string[] = [];
    if (params?.sprint_id) parts.push(`sprint_id=${params.sprint_id}`);
    if (params?.date_from) parts.push(`date_from=${params.date_from}`);
    if (params?.date_to) parts.push(`date_to=${params.date_to}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return request<DashboardData>(`/dashboard${qs}`);
  },
};

// ── Search ──

export const searchApi = {
  search: (q: string, labelIds?: number[]) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (labelIds && labelIds.length > 0) params.set('labels', labelIds.join(','));
    return request<SearchResults>(`/search?${params.toString()}`);
  },
};

// ── Dependencies & Relations ──

export const dependenciesApi = {
  // Tasks this task depends on (is blocked by)
  getDependencies: (taskId: number) => request<LinkedTask[]>(`/tasks/${taskId}/dependencies`),
  // Tasks that depend on this task (this task blocks)
  getDependents: (taskId: number) => request<LinkedTask[]>(`/tasks/${taskId}/dependents`),
  addDependency: (taskId: number, dependsOnTaskId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/dependencies`, { method: 'POST', body: JSON.stringify({ depends_on_task_id: dependsOnTaskId }) }),
  removeDependency: (taskId: number, dependsOnTaskId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/dependencies/${dependsOnTaskId}`, { method: 'DELETE' }),
  // Related tasks (bidirectional)
  getRelations: (taskId: number) => request<LinkedTask[]>(`/tasks/${taskId}/relations`),
  addRelation: (taskId: number, relatedTaskId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/relations`, { method: 'POST', body: JSON.stringify({ related_task_id: relatedTaskId }) }),
  removeRelation: (taskId: number, relatedTaskId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/relations/${relatedTaskId}`, { method: 'DELETE' }),
  // Task-Note links
  getLinkedNotes: (taskId: number) => request<LinkedNote[]>(`/tasks/${taskId}/linked-notes`),
  addNoteLink: (taskId: number, noteId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/linked-notes`, { method: 'POST', body: JSON.stringify({ note_id: noteId }) }),
  removeNoteLink: (taskId: number, noteId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/linked-notes/${noteId}`, { method: 'DELETE' }),
};

// ── Activity Log ──

export const activityApi = {
  getAll: (params?: { entity_type?: string; entity_id?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.entity_type) qs.set('entity_type', params.entity_type);
    if (params?.entity_id) qs.set('entity_id', String(params.entity_id));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<ActivityEntry[]>(`/activity${q ? `?${q}` : ''}`);
  },
  deleteAll: () => request<{ success: boolean }>('/activity', { method: 'DELETE' }),
};

// ── Settings ──

export const settingsApi = {
  getAll: () => request<Record<string, string>>('/settings'),
  update: (key: string, value: string) =>
    request<{ key: string; value: string }>(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
};

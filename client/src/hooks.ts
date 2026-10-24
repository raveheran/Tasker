import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, statusesApi, sprintsApi, labelsApi, templatesApi, userStoriesApi, notesApi, dashboardApi, searchApi, dependenciesApi, activityApi, settingsApi } from './api';
import type {
  TaskFilters, TaskCreateInput, TaskUpdateInput,
  UserStoryFilters, UserStoryCreateInput, UserStoryUpdateInput,
  NoteFilters, NoteCreateInput, NoteUpdateInput,
} from './types';

// ── Tasks ──

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.list(filters),
    placeholderData: (prev) => prev,
  });
}

export function useTask(id: number | null) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.get(id!),
    enabled: id !== null,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskCreateInput) => tasksApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdateInput }) => tasksApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', vars.id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDuplicateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

// ── Subtasks ──

export function useAddSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, title }: { taskId: number; title: string }) =>
      tasksApi.addSubtask(taskId, title),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId, data }: { taskId: number; subtaskId: number; data: Record<string, unknown> }) =>
      tasksApi.updateSubtask(taskId, subtaskId, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId }: { taskId: number; subtaskId: number }) =>
      tasksApi.deleteSubtask(taskId, subtaskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ── My Day ──

export function useMyDayTasks() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['tasks', { do_date_to: today, is_archived: 0 }],
    queryFn: () => tasksApi.list({ do_date_to: today, is_archived: 0 }),
  });
}

export function useAddToMyDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => tasksApi.addToMyDay(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useRemoveFromMyDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) => tasksApi.removeFromMyDay(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useReorderMyDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: number[]) => tasksApi.reorderMyDay(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useReorderKanban() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: number[]) => tasksApi.reorderKanban(order),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useWorkSummary(params: Record<string, string>) {
  return useQuery({
    queryKey: ['work-summary', params],
    queryFn: () => tasksApi.workSummary(params),
    enabled: Object.keys(params).length > 0,
  });
}

// ── Statuses ──

export function useStatuses() {
  return useQuery({
    queryKey: ['statuses'],
    queryFn: statusesApi.list,
  });
}

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: statusesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => statusesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}

export function useDeleteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: statusesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });
}

// ── Sprints ──

export function useSprints() {
  return useQuery({
    queryKey: ['sprints'],
    queryFn: sprintsApi.list,
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sprintsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => sprintsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}

export function useActivateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sprintsApi.activate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sprintsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints'] }),
  });
}

// ── Labels ──

export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: labelsApi.list,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: labelsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

export function useUpdateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => labelsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: labelsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });
}

// ── Templates ──

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
  });
}

export function useTemplate(id: number | null) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => templatesApi.get(id!),
    enabled: id !== null,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<import('./types').Template>) => templatesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<import('./types').Template> }) => templatesApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      qc.invalidateQueries({ queryKey: ['template', vars.id] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => templatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, taskId }: { templateId: number; taskId: number }) =>
      templatesApi.applyToTask(templateId, taskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateTaskFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data?: { status_id?: number; sprint_id?: number } }) =>
      templatesApi.createFromTemplate(templateId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ── User Stories ──

export function useUserStories(filters: UserStoryFilters = {}) {
  return useQuery({
    queryKey: ['user-stories', filters],
    queryFn: () => userStoriesApi.list(filters),
  });
}

export function useUserStory(id: number | null) {
  return useQuery({
    queryKey: ['user-story', id],
    queryFn: () => userStoriesApi.get(id!),
    enabled: id !== null,
  });
}

export function useCreateUserStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UserStoryCreateInput) => userStoriesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-stories'] }),
  });
}

export function useUpdateUserStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserStoryUpdateInput }) => userStoriesApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['user-stories'] });
      qc.invalidateQueries({ queryKey: ['user-story', vars.id] });
    },
  });
}

export function useDeleteUserStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => userStoriesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-stories'] }),
  });
}

// ── Notes ──

export function useNotes(filters: NoteFilters = {}) {
  return useQuery({
    queryKey: ['notes', filters],
    queryFn: () => notesApi.list(filters),
  });
}

export function useNote(id: number | null) {
  return useQuery({
    queryKey: ['note', id],
    queryFn: () => notesApi.get(id!),
    enabled: id !== null,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: NoteCreateInput) => notesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: NoteUpdateInput }) => notesApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      qc.invalidateQueries({ queryKey: ['note', vars.id] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useReorderNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: number; parent_id: number | null; sort_order: number }[]) => notesApi.reorder(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

export function useCreateNoteFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data?: { sprint_id?: number; parent_id?: number | null } }) =>
      templatesApi.createNoteFromTemplate(templateId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });
}

// ── Dashboard ──

export function useDashboard(params?: { sprint_id?: number; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => dashboardApi.get(params),
    refetchInterval: 30000, // refresh every 30s
  });
}

// ── Search ──

export function useSearch(query: string, labelIds?: number[]) {
  return useQuery({
    queryKey: ['search', query, labelIds],
    queryFn: () => searchApi.search(query, labelIds),
    enabled: query.trim().length >= 2 || (labelIds !== undefined && labelIds.length > 0),
    staleTime: 10000,
  });
}

// ── Dependencies & Relations ──

export function useTaskDependencies(taskId: number | null) {
  return useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: () => dependenciesApi.getDependencies(taskId!),
    enabled: taskId !== null,
  });
}

export function useTaskDependents(taskId: number | null) {
  return useQuery({
    queryKey: ['task-dependents', taskId],
    queryFn: () => dependenciesApi.getDependents(taskId!),
    enabled: taskId !== null,
  });
}

export function useAddDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnTaskId }: { taskId: number; dependsOnTaskId: number }) =>
      dependenciesApi.addDependency(taskId, dependsOnTaskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-dependencies', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['task-dependents', vars.dependsOnTaskId] });
    },
  });
}

export function useRemoveDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, dependsOnTaskId }: { taskId: number; dependsOnTaskId: number }) =>
      dependenciesApi.removeDependency(taskId, dependsOnTaskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-dependencies', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['task-dependents', vars.dependsOnTaskId] });
    },
  });
}

export function useTaskRelations(taskId: number | null) {
  return useQuery({
    queryKey: ['task-relations', taskId],
    queryFn: () => dependenciesApi.getRelations(taskId!),
    enabled: taskId !== null,
  });
}

export function useAddRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, relatedTaskId }: { taskId: number; relatedTaskId: number }) =>
      dependenciesApi.addRelation(taskId, relatedTaskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-relations', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['task-relations', vars.relatedTaskId] });
    },
  });
}

export function useRemoveRelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, relatedTaskId }: { taskId: number; relatedTaskId: number }) =>
      dependenciesApi.removeRelation(taskId, relatedTaskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-relations', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['task-relations', vars.relatedTaskId] });
    },
  });
}

// ── Task-Note Links ──

export function useTaskLinkedNotes(taskId: number) {
  return useQuery({
    queryKey: ['task-linked-notes', taskId],
    queryFn: () => dependenciesApi.getLinkedNotes(taskId),
    enabled: !!taskId,
  });
}

export function useAddTaskNoteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, noteId }: { taskId: number; noteId: number }) =>
      dependenciesApi.addNoteLink(taskId, noteId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-linked-notes', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['note-linked-tasks', vars.noteId] });
    },
  });
}

export function useRemoveTaskNoteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, noteId }: { taskId: number; noteId: number }) =>
      dependenciesApi.removeNoteLink(taskId, noteId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task-linked-notes', vars.taskId] });
      qc.invalidateQueries({ queryKey: ['note-linked-tasks', vars.noteId] });
    },
  });
}

export function useNoteLinkedTasks(noteId: number) {
  return useQuery({
    queryKey: ['note-linked-tasks', noteId],
    queryFn: () => notesApi.getLinkedTasks(noteId),
    enabled: !!noteId,
  });
}

export function useAddNoteTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, taskId }: { noteId: number; taskId: number }) =>
      notesApi.addTaskLink(noteId, taskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['note-linked-tasks', vars.noteId] });
      qc.invalidateQueries({ queryKey: ['task-linked-notes', vars.taskId] });
    },
  });
}

export function useRemoveNoteTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, taskId }: { noteId: number; taskId: number }) =>
      notesApi.removeTaskLink(noteId, taskId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['note-linked-tasks', vars.noteId] });
      qc.invalidateQueries({ queryKey: ['task-linked-notes', vars.taskId] });
    },
  });
}

// ── Activity Log ──

export function useActivityLog(params?: { entity_type?: string; entity_id?: number; limit?: number }) {
  return useQuery({
    queryKey: ['activity', params],
    queryFn: () => activityApi.getAll(params),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

export function useDeleteAllActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => activityApi.deleteAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}

// ── Settings ──

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll(),
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.update(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

import { useState, useMemo } from 'react';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { Zap, Calendar, Clock, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useSprints, useTasks, useUserStories, useStatuses, useActivateSprint } from '@/hooks';
import { useUIStore } from '@/store';
import type { Sprint, Task, UserStory, Status } from '@/types';
import { LabelPill } from './LabelPill';

export function SprintOverviewSpace() {
  const { openTaskDetail } = useUIStore();
  const { data: sprints = [] } = useSprints();
  const { data: statuses = [] } = useStatuses();
  const activateSprint = useActivateSprint();

  const activeSprint = sprints.find((s: Sprint) => s.is_active);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [sortTasksByLabel, setSortTasksByLabel] = useState(false);
  const sprintId = selectedSprintId ?? activeSprint?.id ?? null;

  const { data: tasks = [] } = useTasks(sprintId ? { sprint_id: sprintId, is_archived: 0 } : { is_archived: 0 });
  const { data: stories = [] } = useUserStories(sprintId ? { sprint_id: sprintId, is_archived: 0 } : { is_archived: 0 });

  const sprintTasks = useMemo(() => sprintId ? tasks.filter((t: Task) => t.sprint_id === sprintId) : [], [tasks, sprintId]);
  const sprintStories = useMemo(() => sprintId ? stories.filter((s: UserStory) => s.sprint_id === sprintId) : [], [stories, sprintId]);

  const sprint = sprints.find((s: Sprint) => s.id === sprintId);

  const statusMap = useMemo(() => new Map(statuses.map((s: Status) => [s.id, s])), [statuses]);

  // Stats
  const totalTasks = sprintTasks.length;
  const doneTasks = sprintTasks.filter((t: Task) => {
    const status = statusMap.get(t.status_id);
    return status?.name === 'Done';
  }).length;
  const inProgressTasks = sprintTasks.filter((t: Task) => {
    const status = statusMap.get(t.status_id);
    return status?.name === 'In Progress';
  }).length;
  const totalEffort = sprintTasks.reduce((sum: number, t: Task) => sum + (t.effort_estimate || 0), 0);
  const doneEffort = sprintTasks
    .filter((t: Task) => statusMap.get(t.status_id)?.name === 'Done')
    .reduce((sum: number, t: Task) => sum + (t.effort_estimate || 0), 0);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, { status: Status; tasks: Task[] }> = {};
    const sortedStatuses = [...statuses].sort((a, b) => a.sort_order - b.sort_order);
    sortedStatuses.forEach(s => { groups[s.id] = { status: s, tasks: [] }; });
    sprintTasks.forEach((t: Task) => {
      if (groups[t.status_id]) groups[t.status_id].tasks.push(t);
    });
    return Object.values(groups).filter(g => g.tasks.length > 0);
  }, [sprintTasks, statuses]);

  const labelChartData = useMemo(() => {
    const labels = new Map<number, { name: string; color: string; count: number }>();
    sprintTasks.forEach((task: Task) => task.labels.forEach((label) => {
      const current = labels.get(label.id);
      labels.set(label.id, current
        ? { ...current, count: current.count + 1 }
        : { name: label.name, color: label.color, count: 1 });
    }));
    return [...labels.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [sprintTasks]);

  const taskFlowChartData = useMemo(() => {
    const days = new Map<string, { date: string; created: number; completed: number }>();
    const addEvent = (dateTime: string | null, key: 'created' | 'completed') => {
      if (!dateTime) return;
      const date = dateTime.slice(0, 10);
      const current = days.get(date) || { date, created: 0, completed: 0 };
      current[key] += 1;
      days.set(date, current);
    };

    sprintTasks.forEach((task: Task) => {
      addEvent(task.created_at, 'created');
      addEvent(task.completed_at, 'completed');
    });

    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [sprintTasks]);

  // Sprint date info
  const daysLeft = sprint?.end_date
    ? Math.max(0, differenceInDays(new Date(sprint.end_date), new Date()))
    : null;
  const isOverdue = sprint?.end_date ? isPast(new Date(sprint.end_date)) && !isToday(new Date(sprint.end_date)) : false;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Sprint Overview</h2>
        </div>

        {/* Sprint selector */}
        <div className="flex items-center gap-3">
          <select
            value={sprintId ?? ''}
            onChange={e => setSelectedSprintId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Select sprint...</option>
            {sprints.map((s: Sprint) => (
              <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' ★' : ''}</option>
            ))}
          </select>
          {sprint && !sprint.is_active && (
            <button
              onClick={() => activateSprint.mutate(sprint.id)}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Set Active
            </button>
          )}
          {sprint?.is_active && (
            <span className="text-xs text-primary font-medium">★ Active Sprint</span>
          )}
        </div>
      </div>

      {!sprint ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          {sprints.length === 0 ? 'Create a sprint in Settings to get started.' : 'Select a sprint above.'}
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Sprint dates */}
          {(sprint.start_date || sprint.end_date) && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {sprint.start_date && <span>{format(new Date(sprint.start_date), 'MMM d')}</span>}
                {sprint.start_date && sprint.end_date && <span>→</span>}
                {sprint.end_date && <span>{format(new Date(sprint.end_date), 'MMM d, yyyy')}</span>}
              </div>
              {daysLeft !== null && (
                <div className={cn('flex items-center gap-1', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                  {isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  <span>{isOverdue ? 'Overdue' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}</span>
                </div>
              )}
              <select
                aria-label="Order In Progress and Done tasks"
                value={sortTasksByLabel ? 'label' : 'default'}
                onChange={(event) => setSortTasksByLabel(event.target.value === 'label')}
                className="h-7 rounded border border-input bg-transparent px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="default">Order tasks: default</option>
                <option value="label">Order tasks: label</option>
              </select>
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Tasks" value={totalTasks} />
            <StatCard label="Done" value={doneTasks} highlight={doneTasks === totalTasks && totalTasks > 0} />
            <StatCard label="In Progress" value={inProgressTasks} />
            <StatCard label="Effort" value={`${doneEffort}/${totalEffort}d`} />
          </div>

          {/* Progress bar */}
          {totalTasks > 0 && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span>{Math.round((doneTasks / totalTasks) * 100)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Sprint analytics */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="Label Distribution">
              {labelChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={labelChartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {labelChartData.map((label) => <Cell key={label.name} fill={label.color} />)}
                    </Pie>
                    <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Task Flow">
              {taskFlowChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={taskFlowChartData} barGap={3}>
                    <XAxis dataKey="date" tickFormatter={(date) => format(new Date(`${date}T00:00:00`), 'MMM d')} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                    <Tooltip labelFormatter={(date) => format(new Date(`${date}T00:00:00`), 'MMM d, yyyy')} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                    <Bar dataKey="created" name="Created" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#34d399" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

          </div>

          {/* User Stories in this sprint */}
          {sprintStories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">User Stories ({sprintStories.length})</h3>
              <div className="space-y-1">
                {sprintStories.map((s: UserStory) => {
                  const status = statusMap.get(s.status_id);
                  return (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-card-border text-sm">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: status?.color || '#6b7280' }} />
                      <span className="truncate text-foreground flex-1">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{status?.name}</span>
                      {s.task_count !== undefined && (
                        <span className="text-xs text-muted-foreground">{s.task_count} tasks</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks grouped by status */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Tasks by Status</h3>
            {tasksByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks in this sprint.</p>
            ) : (
              <div className="space-y-4">
                {tasksByStatus.map(({ status, tasks: statusTasks }) => {
                  const supportsLabelSorting = status.name === 'In Progress' || status.name === 'Done';
                  const displayedTasks = sortTasksByLabel && supportsLabelSorting ? sortTasksByLabelOrder(statusTasks) : statusTasks;

                  return (
                  <div key={status.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-xs font-medium" style={{ color: status.color }}>{status.name}</span>
                      <span className="text-xs text-muted-foreground">({statusTasks.length})</span>
                    </div>
                    <div className="space-y-1 ml-4">
                      {displayedTasks.map((t: Task) => (
                        <button
                          key={t.id}
                          onClick={() => openTaskDetail(t.id)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded hover:bg-secondary text-left text-sm text-foreground"
                        >
                          <span className="truncate flex-1">{t.title}</span>
                          {t.effort_estimate != null && (
                            <span className="text-xs text-muted-foreground">{t.effort_estimate}d</span>
                          )}
                          {t.do_date && (
                            <span className="text-xs text-muted-foreground">{format(new Date(t.do_date), 'MMM d')}</span>
                          )}
                          {t.labels.length > 0 && (
                            <span className="flex max-w-[45%] shrink-0 flex-wrap justify-end gap-1">
                              {t.labels.map((label) => (
                                <LabelPill key={label.id} label={label} size="xs" />
                              ))}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function sortTasksByLabelOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aLabel = a.labels[0]?.name;
    const bLabel = b.labels[0]?.name;

    if (!aLabel && !bLabel) return a.title.localeCompare(b.title);
    if (!aLabel) return 1;
    if (!bLabel) return -1;

    return aLabel.localeCompare(bLabel) || a.title.localeCompare(b.title);
  });
}

const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 };
const TOOLTIP_STYLE = { backgroundColor: '#1a1b23', border: '1px solid #2e303a', borderRadius: '6px' };
const TOOLTIP_ITEM_STYLE = { color: '#e5e7eb' };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-card-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function EmptyChart() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No chart data</div>;
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-lg border border-card-border bg-card p-4',
      highlight && 'border-primary/40 bg-primary/5',
    )}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-xl font-semibold', highlight ? 'text-primary' : 'text-foreground')}>{value}</div>
    </div>
  );
}

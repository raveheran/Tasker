import { useState, useMemo } from 'react';
import { useDashboard, useSprints } from '@/hooks';
import { useUIStore } from '@/store';
import { startOfWeek, startOfMonth, subDays, format } from 'date-fns';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  ListTodo, Clock, AlertTriangle, CheckCircle2,
  BookOpen, StickyNote, Zap,
} from 'lucide-react';
import type { DashboardRecentTask } from '@/types';

const PHASE_LABELS: Record<string, string> = {
  planning: 'Planning',
  execution: 'Execution',
  any: 'Any Phase',
};

type DatePreset = 'all' | 'week' | 'month' | '30d';

function getDateRange(preset: DatePreset): { date_from?: string; date_to?: string } {
  if (preset === 'all') return {};
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');
  if (preset === 'week') return { date_from: format(startOfWeek(today), 'yyyy-MM-dd'), date_to: to };
  if (preset === 'month') return { date_from: format(startOfMonth(today), 'yyyy-MM-dd'), date_to: to };
  return { date_from: format(subDays(today, 30), 'yyyy-MM-dd'), date_to: to };
}

export function DashboardSpace() {
  const [sprintId, setSprintId] = useState<number | undefined>();
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const dashParams = useMemo(() => ({
    ...(sprintId ? { sprint_id: sprintId } : {}),
    ...dateRange,
  }), [sprintId, dateRange]);
  const { data, isLoading, error } = useDashboard(Object.keys(dashParams).length ? dashParams : undefined);
  const { data: sprints = [] } = useSprints();
  const openTaskDetail = useUIStore((s) => s.openTaskDetail);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        Failed to load dashboard data
      </div>
    );
  }

  const statusChartData = data.tasksByStatus.filter((s) => s.count > 0);
  const phaseChartData = data.tasksByPhase.map((p) => ({
    name: PHASE_LABELS[p.phase] || p.phase,
    count: p.count,
  }));
  const activeTasks = data.totalTasks - data.doneTasks;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <select
          value={sprintId ?? ''}
          onChange={(e) => setSprintId(e.target.value ? Number(e.target.value) : undefined)}
          className="h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
        >
          <option value="">All sprints</option>
          {sprints.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset)}
          className="h-8 px-2 bg-secondary text-foreground text-sm rounded-md border border-input"
        >
          <option value="all">All time</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <SummaryCard icon={ListTodo} label="Total Tasks" value={data.totalTasks} color="text-primary" />
        <SummaryCard icon={CheckCircle2} label="Done" value={data.doneTasks} color="text-emerald-400" />
        <SummaryCard icon={Zap} label="Active" value={activeTasks} color="text-amber-400" />
        <SummaryCard icon={Clock} label="Due Today" value={data.dueToday} color="text-sky-400" />
        <SummaryCard icon={AlertTriangle} label="Overdue" value={data.overdue} color={data.overdue > 0 ? 'text-red-400' : 'text-muted-foreground'} />
        <SummaryCard icon={BookOpen} label="Stories" value={data.totalStories} color="text-purple-400" />
      </div>

      {/* Sprint progress (if active) */}
      {data.activeSprint && (
        <div className="bg-card rounded-lg border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Active Sprint: {data.activeSprint.name}
            </h2>
            <span className="text-xs text-muted-foreground">
              {data.activeSprint.start_date || '?'} → {data.activeSprint.end_date || '?'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-sm text-muted-foreground">
              Tasks: <span className="text-foreground font-medium">{data.activeSprint.done_tasks}/{data.activeSprint.total_tasks}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Effort: <span className="text-foreground font-medium">{data.activeSprint.done_effort}/{data.activeSprint.total_effort}h</span>
            </div>
          </div>
          <ProgressBar
            value={data.activeSprint.total_tasks > 0 ? data.activeSprint.done_tasks / data.activeSprint.total_tasks : 0}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Status (Pie) */}
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tasks by Status</h2>
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, value }: any) => `${name} (${value})`}
                  labelLine={false}
                >
                  {statusChartData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1b23', border: '1px solid #2e303a', borderRadius: '6px' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No tasks yet
            </div>
          )}
        </div>

        {/* Tasks by Phase (Bar) */}
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Tasks by Phase</h2>
          {phaseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={phaseChartData} barSize={36}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1b23', border: '1px solid #2e303a', borderRadius: '6px' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No tasks yet
            </div>
          )}
        </div>

        {/* Tasks by Label (Bar) */}
        {data.tasksByLabel.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Tasks by Label</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.tasksByLabel} barSize={28} layout="vertical">
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1b23', border: '1px solid #2e303a', borderRadius: '6px' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.tasksByLabel.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Completion Donut */}
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Completion Rate</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Done', value: data.doneTasks },
                  { name: 'Remaining', value: activeTasks },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
              >
                <Cell fill="#34d399" />
                <Cell fill="#374151" />
              </Pie>
              <Legend
                formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1b23', border: '1px solid #2e303a', borderRadius: '6px' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center -mt-2">
            <span className="text-2xl font-bold text-foreground">
              {data.totalTasks > 0 ? Math.round((data.doneTasks / data.totalTasks) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentTasks.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Recently Updated</h2>
          <div className="space-y-2">
            {data.recentTasks.map((task: DashboardRecentTask) => (
              <button
                key={task.id}
                onClick={() => openTaskDetail(task.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 transition-colors text-left"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.status_color }}
                />
                <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                {task.labels?.length > 0 && (
                  <span className="flex gap-1 flex-shrink-0">
                    {task.labels.slice(0, 3).map((l, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${l.color}20`, color: l.color }}>
                        {l.name}
                      </span>
                    ))}
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {task.status_name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(task.updated_at).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes count row */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground pb-4">
        <StickyNote className="h-4 w-4" />
        {data.totalNotes} note{data.totalNotes !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="w-full bg-secondary rounded-full h-2.5">
      <div
        className="bg-primary h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
      <div className="text-xs text-muted-foreground mt-1 text-right">{pct}%</div>
    </div>
  );
}

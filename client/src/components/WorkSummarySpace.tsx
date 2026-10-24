import { useState, useMemo } from 'react';
import { useWorkSummary, useSprints } from '@/hooks';
import { ClipboardCopy, Check, FileText } from 'lucide-react';
import { format, subDays, startOfWeek, subWeeks, startOfMonth, subMonths } from 'date-fns';
import type { Sprint } from '@/types';

type Scope = 'sprint' | 'last-week' | 'this-week' | 'last-month' | 'this-month' | 'custom';

function getDateRange(scope: Scope): { date_from: string; date_to: string } | null {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (scope) {
    case 'this-week': {
      // Sun–Thu work week (weekStartsOn: 0 = Sunday)
      const start = startOfWeek(today, { weekStartsOn: 0 });
      return { date_from: fmt(start), date_to: fmt(today) };
    }
    case 'last-week': {
      const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
      const lastWeekEnd = subDays(startOfWeek(today, { weekStartsOn: 0 }), 1);
      return { date_from: fmt(lastWeekStart), date_to: fmt(lastWeekEnd) };
    }
    case 'this-month': {
      return { date_from: fmt(startOfMonth(today)), date_to: fmt(today) };
    }
    case 'last-month': {
      const lm = subMonths(today, 1);
      return { date_from: fmt(startOfMonth(lm)), date_to: fmt(subDays(startOfMonth(today), 1)) };
    }
    default:
      return null;
  }
}

export function WorkSummarySpace() {
  const { data: sprints = [] } = useSprints();
  const [scope, setScope] = useState<Scope>('last-week');
  const [sprintId, setSprintId] = useState<number | ''>('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [copied, setCopied] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (scope === 'sprint') {
      if (!sprintId) return {};
      p.scope = 'sprint';
      p.sprint_id = String(sprintId);
    } else if (scope === 'custom') {
      if (!customFrom || !customTo) return {};
      p.date_from = customFrom;
      p.date_to = customTo;
    } else {
      const range = getDateRange(scope);
      if (!range) return {};
      p.date_from = range.date_from;
      p.date_to = range.date_to;
    }
    return p;
  }, [scope, sprintId, customFrom, customTo]);

  const { data, isLoading } = useWorkSummary(params);

  const summaryText = useMemo(() => {
    if (!data) return '';
    const lines: string[] = [];

    // Header
    let scopeLabel: string = scope;
    if (scope === 'sprint') {
      const s = sprints.find((sp: Sprint) => sp.id === Number(sprintId));
      scopeLabel = s ? `Sprint: ${s.name}` : 'Sprint';
    } else if (scope === 'custom') {
      scopeLabel = `${customFrom} to ${customTo}`;
    } else {
      scopeLabel = scope.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    lines.push(`# Work Summary — ${scopeLabel}`);
    lines.push(`Generated: ${format(new Date(), 'MMM d, yyyy')}`);
    lines.push('');

    // Stats
    lines.push('## Overview');
    lines.push(`- Total tasks: ${data.summary.total}`);
    lines.push(`- Completed: ${data.summary.completed}`);
    lines.push(`- In Progress: ${data.summary.in_progress}`);
    lines.push(`- Effort completed: ${data.summary.completed_effort}d / ${data.summary.total_effort}d`);
    lines.push('');

    // Completed tasks
    if (data.completed_tasks.length > 0) {
      lines.push('## Completed Tasks');
      data.completed_tasks.forEach((t: any) => {
        let line = `- ${t.title}`;
        const meta: string[] = [];
        if (t.effort) meta.push(`${t.effort}d`);
        if (t.labels?.length) meta.push(t.labels.join(', '));
        if (t.sprint) meta.push(t.sprint);
        if (t.user_story) meta.push(`Story: ${t.user_story}`);
        if (meta.length) line += ` (${meta.join(' · ')})`;
        lines.push(line);
      });
      lines.push('');
    }

    // In progress
    if (data.in_progress_tasks.length > 0) {
      lines.push('## Still In Progress');
      data.in_progress_tasks.forEach((t: any) => {
        let line = `- ${t.title} [${t.status}]`;
        const meta: string[] = [];
        if (t.effort) meta.push(`${t.effort}d`);
        if (t.labels?.length) meta.push(t.labels.join(', '));
        if (t.sprint) meta.push(t.sprint);
        if (meta.length) line += ` (${meta.join(' · ')})`;
        lines.push(line);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push('Please summarize the work done in this period in a concise report suitable for a standup or sprint review. Group by theme/area if possible.');

    return lines.join('\n');
  }, [data, scope, sprintId, sprints, customFrom, customTo]);

  const handleCopy = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Work Summary</h2>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={scope}
            onChange={e => setScope(e.target.value as Scope)}
            className="px-3 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="last-week">Last Week</option>
            <option value="this-week">This Week</option>
            <option value="last-month">Last Month</option>
            <option value="this-month">This Month</option>
            <option value="sprint">Sprint</option>
            <option value="custom">Custom Range</option>
          </select>

          {scope === 'sprint' && (
            <select
              value={sprintId}
              onChange={e => setSprintId(e.target.value ? Number(e.target.value) : '')}
              className="px-3 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select sprint…</option>
              {sprints.map((s: Sprint) => (
                <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' ★' : ''}</option>
              ))}
            </select>
          )}

          {scope === 'custom' && (
            <>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 bg-secondary rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </>
          )}

          {summaryText && (
            <button
              onClick={handleCopy}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          Loading…
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          Select a scope above to generate a work summary.
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total" value={data.summary.total} />
            <StatCard label="Completed" value={data.summary.completed} color="text-emerald-400" />
            <StatCard label="In Progress" value={data.summary.in_progress} color="text-amber-400" />
            <StatCard label="Done Effort" value={`${data.summary.completed_effort}d`} color="text-sky-400" />
            <StatCard label="Total Effort" value={`${data.summary.total_effort}d`} />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Preview (copy this into your LLM)</h3>
            <pre className="bg-secondary/50 border border-border rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
              {summaryText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold ${color || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

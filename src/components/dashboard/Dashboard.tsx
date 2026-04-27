'use client';

import { useMemo, useState } from 'react';
import { Search, Calendar, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';

export type DashboardDateFilter =
  | 'today'
  | 'tomorrow'
  | 'this_week'
  | 'next_7_days'
  | 'overdue'
  | 'no_due_date'
  | 'custom_range';

export type DashboardQuickFilter = 'all' | 'my_tasks' | 'overdue' | 'due_today' | 'no_assignee';

type DashboardProps = {
  onCreateClient?: () => void;
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onUploadAsset?: () => void;
  onSearchChange?: (value: string) => void;
  onDateFilterChange?: (value: DashboardDateFilter) => void;
  onQuickFilterChange?: (value: DashboardQuickFilter) => void;
};

const DATE_FILTER_OPTIONS: Array<{ value: DashboardDateFilter; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This week' },
  { value: 'next_7_days', label: 'Next 7 days' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'no_due_date', label: 'No due date' },
  { value: 'custom_range', label: 'Custom range' },
];

const QUICK_FILTER_OPTIONS: Array<{ value: DashboardQuickFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'my_tasks', label: 'My tasks' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_today', label: 'Due today' },
  { value: 'no_assignee', label: 'No assignee' },
];

export default function Dashboard({
  onCreateClient,
  onCreateTask,
  onCreateProject,
  onUploadAsset,
  onSearchChange,
  onDateFilterChange,
  onQuickFilterChange,
}: DashboardProps) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DashboardDateFilter>('this_week');
  const [quickFilter, setQuickFilter] = useState<DashboardQuickFilter>('all');
  const [openDateMenu, setOpenDateMenu] = useState(false);

  const activeDateLabel = useMemo(
    () => DATE_FILTER_OPTIONS.find((option) => option.value === dateFilter)?.label ?? 'This week',
    [dateFilter],
  );

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              onSearchChange?.(value);
            }}
            type="search"
            placeholder="Search anything..."
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pe-14 ps-9 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
          />
          <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
            ⌘K
          </span>
        </label>

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenDateMenu((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={openDateMenu}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            <Calendar className="h-4 w-4 text-[var(--text-secondary)]" />
            {activeDateLabel}
            <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
          </button>
          {openDateMenu ? (
            <div
              role="menu"
              className="absolute start-0 top-full z-30 mt-2 w-[240px] max-w-[260px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-md)]"
            >
              {DATE_FILTER_OPTIONS.map((option) => {
                const active = option.value === dateFilter;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setDateFilter(option.value);
                      setOpenDateMenu(false);
                      onDateFilterChange?.(option.value);
                    }}
                    className="flex h-9 w-full items-center rounded-lg px-2.5 text-sm transition-colors"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" onClick={onCreateClient}>
            + Add Client
          </Button>
          <Button type="button" variant="secondary" onClick={onCreateTask}>
            New Task
          </Button>
          <Button type="button" variant="secondary" onClick={onCreateProject}>
            New Project
          </Button>
          <Button type="button" variant="secondary" onClick={onUploadAsset}>
            Upload Asset
          </Button>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-max items-center gap-2">
          {QUICK_FILTER_OPTIONS.map((option) => {
            const active = option.value === quickFilter;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setQuickFilter(option.value);
                  onQuickFilterChange?.(option.value);
                }}
                className="inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors"
                style={{
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

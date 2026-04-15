'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, LayoutDashboard, Users2, CheckSquare, FolderOpen,
  BarChart2, Users, Shield, CalendarDays, FileText, Upload,
  Plus, UserCheck, Settings, Zap, Clock, Tag, BookOpen, BookMarked,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  group: string;
  keywords?: string[];
  action: () => void;
}

// ─── Command palette ───────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Callbacks for actions that require parent to orchestrate (e.g. open modals) */
  onOpenUpload?: () => void;
  onOpenNewTask?: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  onOpenUpload,
  onOpenNewTask,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Actions ────────────────────────────────────────────────────────────────

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  const allActions: PaletteAction[] = [
    // ── Create ──
    {
      id: 'new-task',
      label: 'Create new task',
      description: 'Add a task for a client or team member',
      icon: Plus,
      group: 'Create',
      keywords: ['new', 'task', 'create', 'add'],
      action: () => { onClose(); onOpenNewTask?.(); },
    },
    {
      id: 'upload-file',
      label: 'Upload file',
      description: 'Upload assets to Google Drive',
      icon: Upload,
      group: 'Create',
      keywords: ['upload', 'file', 'asset', 'drive'],
      action: () => { onClose(); onOpenUpload?.(); },
    },

    // ── Navigate ──
    {
      id: 'go-dashboard',
      label: 'Go to Dashboard',
      icon: LayoutDashboard,
      group: 'Navigate',
      keywords: ['home', 'dash', 'overview'],
      action: () => go('/dashboard'),
    },
    {
      id: 'go-my-tasks',
      label: 'Go to My Tasks',
      icon: UserCheck,
      group: 'Navigate',
      keywords: ['my', 'tasks', 'assigned'],
      action: () => go('/my-tasks'),
    },
    {
      id: 'go-clients',
      label: 'Go to Clients',
      icon: Users2,
      group: 'Navigate',
      keywords: ['clients', 'companies', 'accounts'],
      action: () => go('/clients'),
    },
    {
      id: 'go-tasks',
      label: 'Go to All Tasks',
      icon: CheckSquare,
      group: 'Navigate',
      keywords: ['tasks', 'work', 'todos'],
      action: () => go('/tasks'),
    },
    {
      id: 'go-content',
      label: 'Go to Content',
      icon: FileText,
      group: 'Navigate',
      keywords: ['content', 'posts', 'social'],
      action: () => go('/content'),
    },
    {
      id: 'go-calendar',
      label: 'Go to Calendar',
      icon: CalendarDays,
      group: 'Navigate',
      keywords: ['calendar', 'schedule', 'dates', 'events'],
      action: () => go('/calendar'),
    },
    {
      id: 'go-assets',
      label: 'Go to Assets',
      icon: FolderOpen,
      group: 'Navigate',
      keywords: ['assets', 'files', 'drive', 'media'],
      action: () => go('/assets'),
    },
    {
      id: 'go-reports',
      label: 'Go to Reports',
      icon: BarChart2,
      group: 'Navigate',
      keywords: ['reports', 'analytics', 'stats'],
      action: () => go('/reports'),
    },
    {
      id: 'go-team',
      label: 'Go to Team',
      icon: Users,
      group: 'Navigate',
      keywords: ['team', 'members', 'invite', 'people'],
      action: () => go('/team'),
    },
    {
      id: 'go-security',
      label: 'Go to Security',
      icon: Shield,
      group: 'Navigate',
      keywords: ['security', 'sessions', 'permissions'],
      action: () => go('/security'),
    },
    {
      id: 'go-settings',
      label: 'Go to Settings',
      icon: Settings,
      group: 'Navigate',
      keywords: ['settings', 'preferences', 'account'],
      action: () => go('/settings'),
    },
    // ── New v3 modules ──
    {
      id: 'go-notes',
      label: 'Go to Notes & Docs',
      icon: BookOpen,
      group: 'Navigate',
      keywords: ['notes', 'docs', 'documents', 'wiki'],
      action: () => go('/notes'),
    },
    {
      id: 'go-time-tracking',
      label: 'Go to Time Tracking',
      icon: Clock,
      group: 'Navigate',
      keywords: ['time', 'timer', 'track', 'hours', 'log'],
      action: () => go('/time-tracking'),
    },
    {
      id: 'go-tags',
      label: 'Go to Tag Manager',
      icon: Tag,
      group: 'Navigate',
      keywords: ['tags', 'labels', 'taxonomy'],
      action: () => go('/tags'),
    },
    {
      id: 'go-automations',
      label: 'Go to Automations',
      icon: Zap,
      group: 'Navigate',
      keywords: ['automation', 'rules', 'trigger', 'workflow'],
      action: () => go('/automations'),
    },
    // ── OPENY DOCS ──
    {
      id: 'go-docs',
      label: 'Go to OPENY DOCS',
      description: 'Business documents, HR, Employees & Accounting',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['docs', 'documents', 'invoice', 'quotation', 'contract', 'hr', 'employees', 'accounting'],
      action: () => go('/docs'),
    },
    {
      id: 'go-docs-invoice',
      label: 'DOCS: Invoice',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['invoice', 'billing', 'docs'],
      action: () => go('/docs/invoice'),
    },
    {
      id: 'go-docs-quotation',
      label: 'DOCS: Quotation',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['quotation', 'quote', 'proposal', 'docs'],
      action: () => go('/docs/quotation'),
    },
    {
      id: 'go-docs-client-contract',
      label: 'DOCS: Client Contract',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['client contract', 'agreement', 'docs'],
      action: () => go('/docs/client-contract'),
    },
    {
      id: 'go-docs-hr-contract',
      label: 'DOCS: HR Contract',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['hr contract', 'employment', 'employee contract', 'docs'],
      action: () => go('/docs/hr-contract'),
    },
    {
      id: 'go-docs-employees',
      label: 'DOCS: Employees',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['employees', 'staff', 'payroll', 'docs'],
      action: () => go('/docs/employees'),
    },
    {
      id: 'go-docs-accounting',
      label: 'DOCS: Accounting',
      icon: BookMarked,
      group: 'Navigate',
      keywords: ['accounting', 'ledger', 'finance', 'revenue', 'docs'],
      action: () => go('/docs/accounting'),
    },
    // ── AI workflows ──
    {
      id: 'ai-start-client',
      label: 'AI: Onboard new client',
      description: 'Let AI create client, project, tasks, and brief',
      icon: Zap,
      group: 'AI Workflows',
      keywords: ['ai', 'client', 'onboard', 'new client', 'workflow'],
      action: () => { onClose(); },
    },
    {
      id: 'ai-prepare-month',
      label: 'AI: Prepare next month',
      description: 'Create monthly planning tasks for all active clients',
      icon: Zap,
      group: 'AI Workflows',
      keywords: ['ai', 'month', 'plan', 'prepare', 'schedule'],
      action: () => { onClose(); },
    },
    {
      id: 'ai-clean-workspace',
      label: 'AI: Clean workspace',
      description: 'Find overdue tasks, orphaned records, and missing fields',
      icon: Zap,
      group: 'AI Workflows',
      keywords: ['ai', 'clean', 'audit', 'overdue', 'workspace'],
      action: () => { onClose(); },
    },
  ];

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = query.trim()
    ? allActions.filter(a => {
        const q = query.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          (a.description ?? '').toLowerCase().includes(q) ||
          (a.keywords ?? []).some(k => k.toLowerCase().includes(q))
        );
      })
    : allActions;

  // Group filtered results
  const groups = filtered.reduce<Record<string, PaletteAction[]>>((acc, a) => {
    if (!acc[a.group]) acc[a.group] = [];
    acc[a.group].push(a);
    return acc;
  }, {});
  const flatFiltered = filtered;

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-active="true"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = flatFiltered[activeIdx];
      if (action) action.action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  // Reset active when query changes
  useEffect(() => { setActiveIdx(0); }, [query]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[510] top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <Zap size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands or navigate…"
            className="flex-1 h-14 text-base bg-transparent outline-none"
            style={{ color: 'var(--text)' }}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-xs px-2 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="overflow-y-auto max-h-[60vh] py-2"
        >
          {flatFiltered.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search size={28} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No commands found for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}

          {(Object.entries(groups) as [string, PaletteAction[]][]).map(([group, items]) => (
            <div key={group}>
              <div className="px-4 pt-3 pb-1">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {group}
                </span>
              </div>
              {items.map(action => {
                const globalIdx = flatFiltered.indexOf(action);
                const isActive = globalIdx === activeIdx;
                return (
                  <button
                    key={action.id}
                    data-active={isActive}
                    onClick={action.action}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      isActive ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]',
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                      }}
                    >
                      <action.icon
                        size={16}
                        style={{ color: isActive ? '#fff' : 'var(--text-secondary)' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--text)' }}
                      >
                        {action.label}
                      </p>
                      {action.description && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {action.description}
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        opacity: isActive ? 1 : 0,
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >↵</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2.5 border-t flex items-center gap-4 text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <span><kbd className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[10px]">↵</kbd> Run</span>
          <span><kbd className="font-mono bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> Close</span>
          <span className="ml-auto opacity-60">⌘K to toggle</span>
        </div>
      </div>
    </>
  );
}

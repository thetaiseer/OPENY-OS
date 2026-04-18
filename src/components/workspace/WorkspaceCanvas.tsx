'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FolderOpen,
  Grid3X3,
  Maximize2,
  Minimize2,
  Plus,
  Users2,
  FileText,
  BarChart3,
  X,
} from 'lucide-react';
import { useDashboardStats } from '@/lib/queries';
import supabase from '@/lib/supabase';
import type { Asset, Client, ContentItem, Task } from '@/lib/types';

export type WorkspaceBlockId = 'tasks' | 'clients' | 'assets' | 'content' | 'calendar' | 'stats';

type ViewPreset = 'balanced' | 'focus' | 'compact';

interface LayoutItem {
  id: WorkspaceBlockId;
  colSpan: number;
}

const BASE_LAYOUT: LayoutItem[] = [
  { id: 'stats', colSpan: 4 },
  { id: 'tasks', colSpan: 4 },
  { id: 'calendar', colSpan: 4 },
  { id: 'clients', colSpan: 6 },
  { id: 'assets', colSpan: 3 },
  { id: 'content', colSpan: 3 },
];

const CLAMP_MIN = 3;
const CLAMP_MAX = 12;

function clampSpan(value: number) {
  return Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, value));
}

function buildLayout(preset: ViewPreset, focus: WorkspaceBlockId): LayoutItem[] {
  if (preset === 'balanced') return BASE_LAYOUT;
  if (preset === 'compact') {
    return BASE_LAYOUT.map(item => ({ ...item, colSpan: item.id === focus ? 6 : 3 }));
  }
  return BASE_LAYOUT.map(item => ({ ...item, colSpan: item.id === focus ? 8 : 4 }));
}

function useOutsideClick<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      onClose();
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [onClose]);

  return ref;
}

function WorkspaceDropdown({
  value,
  onChange,
}: {
  value: ViewPreset;
  onChange: (value: ViewPreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const options: Array<{ id: ViewPreset; label: string; description: string }> = [
    { id: 'balanced', label: 'Balanced', description: 'Equal visual weight across blocks' },
    { id: 'focus', label: 'Focus', description: 'Prioritize the selected block' },
    { id: 'compact', label: 'Compact', description: 'Fit more content in less space' },
  ];
  const selected = options.find(option => option.id === value) ?? options[0];

  return (
    <div className="ws-dropdown" ref={ref}>
      <button type="button" className="ws-dropdown-trigger" onClick={() => setOpen(prev => !prev)}>
        <Grid3X3 size={14} />
        <span>{selected.label} view</span>
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open ? (
        <div className="ws-dropdown-menu">
          {options.map(option => (
            <button
              key={option.id}
              type="button"
              className={`ws-dropdown-item ${option.id === value ? 'is-active' : ''}`}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BlockFrame({
  item,
  children,
  focused,
  onResize,
  onMove,
  onExpand,
}: {
  item: LayoutItem;
  children: React.ReactNode;
  focused: boolean;
  onResize: (delta: number) => void;
  onMove: (delta: number) => void;
  onExpand: () => void;
}) {
  return (
    <article
      className={`ws-block ${focused ? 'is-focused' : ''}`}
      style={{ gridColumn: `span ${item.colSpan}` }}
    >
      <div className="ws-block-controls">
        <button type="button" className="ws-icon-btn" onClick={() => onMove(-1)} aria-label="Move block left">
          <ArrowUp size={14} />
        </button>
        <button type="button" className="ws-icon-btn" onClick={() => onMove(1)} aria-label="Move block right">
          <ArrowDown size={14} />
        </button>
        <button type="button" className="ws-icon-btn" onClick={() => onResize(-1)} aria-label="Reduce block width">
          <Minimize2 size={14} />
        </button>
        <button type="button" className="ws-icon-btn" onClick={() => onResize(1)} aria-label="Increase block width">
          <Plus size={14} />
        </button>
        <button type="button" className="ws-icon-btn" onClick={onExpand} aria-label="Expand block">
          <Maximize2 size={14} />
        </button>
      </div>
      {children}
    </article>
  );
}

function BlockBody({ id }: { id: WorkspaceBlockId }) {
  const { data: stats } = useDashboardStats();

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['workspace-block-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('id,title,status,due_date').order('created_at', { ascending: false }).limit(6);
      if (error) throw new Error(error.message);
      return (data ?? []) as Task[];
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['workspace-block-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id,name,status,created_at').order('created_at', { ascending: false }).limit(6);
      if (error) throw new Error(error.message);
      return (data ?? []) as Client[];
    },
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['workspace-block-assets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('assets').select('id,name,content_type,created_at').order('created_at', { ascending: false }).limit(6);
      if (error) throw new Error(error.message);
      return (data ?? []) as Asset[];
    },
  });

  const { data: content = [] } = useQuery<ContentItem[]>({
    queryKey: ['workspace-block-content'],
    queryFn: async () => {
      const { data, error } = await supabase.from('content_items').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(6);
      if (error) throw new Error(error.message);
      return (data ?? []) as ContentItem[];
    },
  });

  const { data: calendarRows = [] } = useQuery<Array<Pick<Task, 'id' | 'title' | 'due_date'>>>({
    queryKey: ['workspace-block-calendar'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,due_date')
        .gte('due_date', today)
        .order('due_date', { ascending: true })
        .limit(6);
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<Pick<Task, 'id' | 'title' | 'due_date'>>;
    },
  });

  if (id === 'stats') {
    return (
      <div className="ws-metrics-grid">
        <div><small>Clients</small><strong>{stats?.totalClients ?? 0}</strong></div>
        <div><small>Active tasks</small><strong>{stats?.activeTasks ?? 0}</strong></div>
        <div><small>Overdue</small><strong>{stats?.overdueTasks ?? 0}</strong></div>
        <div><small>Assets</small><strong>{stats?.totalAssets ?? 0}</strong></div>
      </div>
    );
  }

  if (id === 'tasks') {
    return (
      <ul className="ws-list">
        {tasks.map(task => (
          <li key={task.id}>
            <span>{task.title}</span>
            <em>{task.status.replace('_', ' ')}</em>
          </li>
        ))}
      </ul>
    );
  }

  if (id === 'clients') {
    return (
      <ul className="ws-list">
        {clients.map(client => (
          <li key={client.id}>
            <span>{client.name}</span>
            <em>{client.status}</em>
          </li>
        ))}
      </ul>
    );
  }

  if (id === 'assets') {
    return (
      <ul className="ws-list">
        {assets.map(asset => (
          <li key={asset.id}>
            <span>{asset.name}</span>
            <em>{asset.content_type || 'asset'}</em>
          </li>
        ))}
      </ul>
    );
  }

  if (id === 'content') {
    return (
      <ul className="ws-list">
        {content.map(item => (
          <li key={item.id}>
            <span>{item.title}</span>
            <em>{item.status}</em>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="ws-list">
      {calendarRows.map(entry => (
        <li key={entry.id}>
          <span>{entry.title}</span>
          <em>{entry.due_date ? new Date(entry.due_date).toLocaleDateString() : 'No date'}</em>
        </li>
      ))}
    </ul>
  );
}

const BLOCK_META: Record<WorkspaceBlockId, { title: string; subtitle: string; icon: React.ReactNode; href: string }> = {
  tasks: { title: 'Tasks Block', subtitle: 'Live execution queue', icon: <CheckSquare size={16} />, href: '/os/tasks' },
  clients: { title: 'Clients Block', subtitle: 'Relationship workspace', icon: <Users2 size={16} />, href: '/os/clients' },
  assets: { title: 'Assets Block', subtitle: 'Media library state', icon: <FolderOpen size={16} />, href: '/os/assets' },
  content: { title: 'Content Block', subtitle: 'Production pipeline', icon: <FileText size={16} />, href: '/os/content' },
  calendar: { title: 'Calendar Block', subtitle: 'Upcoming schedule', icon: <CalendarDays size={16} />, href: '/os/calendar' },
  stats: { title: 'Stats Block', subtitle: 'Operational metrics', icon: <BarChart3 size={16} />, href: '/os/reports' },
};

function FullscreenModal({
  block,
  onClose,
}: {
  block: WorkspaceBlockId | null;
  onClose: () => void;
}) {
  if (!block) return null;
  const meta = BLOCK_META[block];
  return (
    <div className="ws-modal-overlay" role="presentation" onClick={onClose}>
      <section className="ws-modal" role="dialog" aria-modal="true" aria-label={meta.title} onClick={event => event.stopPropagation()}>
        <header className="ws-modal-header">
          <div>
            <h2>{meta.title}</h2>
            <p>{meta.subtitle}</p>
          </div>
          <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="ws-modal-body">
          <BlockBody id={block} />
        </div>
      </section>
    </div>
  );
}

export default function WorkspaceCanvas({
  workspaceKey,
  focusBlock,
}: {
  workspaceKey: string;
  focusBlock: WorkspaceBlockId;
}) {
  const [layout, setLayout] = useState<LayoutItem[]>(BASE_LAYOUT);
  const [preset, setPreset] = useState<ViewPreset>('balanced');
  const [expandedBlock, setExpandedBlock] = useState<WorkspaceBlockId | null>(null);

  useEffect(() => {
    const storageKey = `openy.workspace.layout.${workspaceKey}`;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        const initial = buildLayout('balanced', focusBlock);
        setLayout(initial);
        return;
      }
      const parsed = JSON.parse(stored) as LayoutItem[];
      if (Array.isArray(parsed) && parsed.length) setLayout(parsed);
    } catch {
      setLayout(buildLayout('balanced', focusBlock));
    }
  }, [workspaceKey, focusBlock]);

  useEffect(() => {
    const storageKey = `openy.workspace.layout.${workspaceKey}`;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      // ignore persistence errors
    }
  }, [layout, workspaceKey]);

  const ordered = useMemo(() => {
    const ids = new Set(layout.map(item => item.id));
    const missing = BASE_LAYOUT.filter(item => !ids.has(item.id));
    return [...layout, ...missing];
  }, [layout]);

  function updateItem(itemId: WorkspaceBlockId, updater: (item: LayoutItem, index: number) => LayoutItem, reorderDelta?: number) {
    setLayout(prev => {
      const current = [...prev];
      const index = current.findIndex(item => item.id === itemId);
      if (index < 0) return prev;
      current[index] = updater(current[index], index);
      if (typeof reorderDelta === 'number') {
        const nextIndex = index + reorderDelta;
        if (nextIndex >= 0 && nextIndex < current.length) {
          const [moved] = current.splice(index, 1);
          current.splice(nextIndex, 0, moved);
        }
      }
      return current;
    });
  }

  return (
    <>
      <section className="ws-canvas-shell">
        <div className="ws-canvas-toolbar">
          <WorkspaceDropdown
            value={preset}
            onChange={nextPreset => {
              setPreset(nextPreset);
              setLayout(buildLayout(nextPreset, focusBlock));
            }}
          />
          <Link href={BLOCK_META[focusBlock].href} className="ws-link-action">Open focused block</Link>
        </div>
        <div className="ws-canvas-grid">
          {ordered.map(item => {
            const meta = BLOCK_META[item.id];
            return (
              <BlockFrame
                key={item.id}
                item={item}
                focused={item.id === focusBlock}
                onResize={delta => updateItem(item.id, block => ({ ...block, colSpan: clampSpan(block.colSpan + delta) }))}
                onMove={delta => updateItem(item.id, block => block, delta)}
                onExpand={() => setExpandedBlock(item.id)}
              >
                <header className="ws-block-header">
                  <div className="ws-block-title-wrap">
                    <span className="ws-block-icon">{meta.icon}</span>
                    <div>
                      <h3>{meta.title}</h3>
                      <p>{meta.subtitle}</p>
                    </div>
                  </div>
                  <Link href={meta.href} className="ws-block-link">Open</Link>
                </header>
                <BlockBody id={item.id} />
              </BlockFrame>
            );
          })}
        </div>
      </section>
      <FullscreenModal block={expandedBlock} onClose={() => setExpandedBlock(null)} />
    </>
  );
}

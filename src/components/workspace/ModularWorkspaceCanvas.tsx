'use client';

import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Link from 'next/link';
import { GripVertical, Plus, Trash2, Minimize2, Maximize2 } from 'lucide-react';
import type { Activity, Asset, Client, PublishingSchedule } from '@/lib/types';

type BlockType = 'stats' | 'tasks' | 'clients' | 'calendar' | 'notes' | 'table' | 'chart';

interface BlockLayout {
  id: string;
  type: BlockType;
  w: number;
  h: number;
}

interface DashboardStats {
  totalClients: number;
  activeTasks: number;
  overdueTasks: number;
  tasksDueThisWeek: number;
  totalAssets?: number;
}

interface ModularWorkspaceCanvasProps {
  stats?: DashboardStats;
  atRiskTasks: Array<{ id: string; title: string; due_date?: string; client?: { name: string; slug?: string } | null }>;
  activeClients: Client[];
  scheduled: PublishingSchedule[];
  activities: Activity[];
  trends: { date: string; completed: number }[];
  recentAssets: Asset[];
}

const DEFAULT_BLOCKS: BlockLayout[] = [
  { id: 'stats', type: 'stats', w: 12, h: 2 },
  { id: 'chart', type: 'chart', w: 8, h: 4 },
  { id: 'tasks', type: 'tasks', w: 4, h: 4 },
  { id: 'clients', type: 'clients', w: 4, h: 4 },
  { id: 'calendar', type: 'calendar', w: 4, h: 4 },
  { id: 'table', type: 'table', w: 4, h: 4 },
  { id: 'notes', type: 'notes', w: 12, h: 3 },
];

const BLOCK_META: Record<BlockType, { title: string; minW: number; minH: number; defaultW: number; defaultH: number }> = {
  stats: { title: 'Stats Block', minW: 6, minH: 2, defaultW: 12, defaultH: 2 },
  tasks: { title: 'Tasks Block', minW: 4, minH: 3, defaultW: 4, defaultH: 4 },
  clients: { title: 'Clients Block', minW: 4, minH: 3, defaultW: 4, defaultH: 4 },
  calendar: { title: 'Calendar Block', minW: 4, minH: 3, defaultW: 4, defaultH: 4 },
  notes: { title: 'Notes Block', minW: 6, minH: 2, defaultW: 12, defaultH: 3 },
  table: { title: 'Table Block', minW: 4, minH: 3, defaultW: 4, defaultH: 4 },
  chart: { title: 'Chart Block', minW: 6, minH: 3, defaultW: 8, defaultH: 4 },
};

const LAYOUT_STORAGE_KEY = 'openy_workspace_layout_v1';
const NOTES_STORAGE_KEY = 'openy_workspace_notes_v1';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function StatsBlock({ stats }: { stats?: DashboardStats }) {
  const metrics = [
    { label: 'Total Clients', value: stats?.totalClients ?? 0 },
    { label: 'Active Tasks', value: stats?.activeTasks ?? 0 },
    { label: 'Overdue', value: stats?.overdueTasks ?? 0 },
    { label: 'Due This Week', value: stats?.tasksDueThisWeek ?? 0 },
    { label: 'Assets', value: stats?.totalAssets ?? 0 },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-xs uppercase tracking-[0.08em]" style={{ color: 'var(--text-secondary)' }}>{metric.label}</p>
          <p className="mt-2 text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{metric.value}</p>
        </div>
      ))}
    </div>
  );
}

function TasksBlock({ tasks }: { tasks: ModularWorkspaceCanvasProps['atRiskTasks'] }) {
  if (!tasks.length) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No tasks at risk.</p>;
  }
  return (
    <div className="space-y-2.5">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="truncate text-sm font-semibold">{task.title}</p>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {task.client?.slug ? <Link href={`/clients/${task.client.slug}/tasks`} className="hover:underline">{task.client.name}</Link> : <span>{task.client?.name ?? 'No client'}</span>}
            <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientsBlock({ clients }: { clients: Client[] }) {
  if (!clients.length) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active clients.</p>;
  }
  return (
    <div className="space-y-2.5">
      {clients.map((client) => (
        <Link key={client.id} href={`/clients/${client.slug ?? client.id}/overview`} className="flex items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <span className="truncate text-sm font-medium">{client.name}</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(client.updated_at).toLocaleDateString()}</span>
        </Link>
      ))}
    </div>
  );
}

function CalendarBlock({ scheduled }: { scheduled: PublishingSchedule[] }) {
  if (!scheduled.length) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No upcoming schedules.</p>;
  }
  return (
    <div className="space-y-2.5">
      {scheduled.map((item) => (
        <div key={item.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="truncate text-sm font-semibold">{item.asset?.name ?? item.caption ?? 'Publishing schedule'}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {new Date(item.scheduled_date).toLocaleDateString()} {item.scheduled_time ? `· ${item.scheduled_time.slice(0, 5)}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

function NotesBlock() {
  const [value, setValue] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(NOTES_STORAGE_KEY);
      if (saved) setValue(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, [value]);

  return (
    <textarea
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder="Write workspace notes..."
      className="h-full min-h-[180px] w-full resize-none rounded-xl border p-3 text-sm"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
    />
  );
}

function TableBlock({ activities, recentAssets }: { activities: Activity[]; recentAssets: Asset[] }) {
  const rows = recentAssets.slice(0, 5).map((asset) => ({
    key: asset.id,
    name: asset.name,
    client: asset.client_name ?? '—',
    date: asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '—',
  }));

  if (!rows.length) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{activities.length ? 'No recent assets.' : 'No data available.'}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Client</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              <td>{row.client}</td>
              <td>{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartBlock({ trends }: { trends: { date: string; completed: number }[] }) {
  const chartData = useMemo(
    () => trends.map((item) => ({ name: new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), completed: item.completed })),
    [trends],
  );

  if (!chartData.length) {
    return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No chart data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="workspaceChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.24} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={22} />
        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' }} />
        <Area type="monotone" dataKey="completed" stroke="var(--accent)" strokeWidth={2.2} fill="url(#workspaceChartFill)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function WorkspaceBlock({
  block,
  onResize,
  onRemove,
  children,
}: {
  block: BlockLayout;
  onResize: (id: string, delta: { w?: number; h?: number }) => void;
  onRemove: (id: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${block.w} / span ${block.w}`,
    gridRow: `span ${block.h} / span ${block.h}`,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="relative flex min-h-0 flex-col rounded-2xl border p-3.5"
      data-block-type={block.type}
      aria-label={BLOCK_META[block.type].title}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" {...attributes} {...listeners} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label={`Move ${BLOCK_META[block.type].title}`}>
            <GripVertical size={14} />
          </button>
          <h2 className="truncate text-sm font-semibold">{BLOCK_META[block.type].title}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onResize(block.id, { w: -1 })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label="Decrease width">
            <Minimize2 size={13} />
          </button>
          <button type="button" onClick={() => onResize(block.id, { w: 1 })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label="Increase width">
            <Maximize2 size={13} />
          </button>
          <button type="button" onClick={() => onResize(block.id, { h: 1 })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label="Increase height">
            H+
          </button>
          <button type="button" onClick={() => onRemove(block.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label={`Remove ${BLOCK_META[block.type].title}`}>
            <Trash2 size={13} />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {isDragging ? <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--accent)' }} /> : null}
    </section>
  );
}

export default function ModularWorkspaceCanvas({
  stats,
  atRiskTasks,
  activeClients,
  scheduled,
  activities,
  trends,
  recentAssets,
}: ModularWorkspaceCanvasProps) {
  const [blocks, setBlocks] = useState<BlockLayout[]>(DEFAULT_BLOCKS);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as BlockLayout[];
      if (Array.isArray(parsed) && parsed.every((block) => block?.id && block?.type && typeof block.w === 'number' && typeof block.h === 'number')) {
        setBlocks(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(blocks));
    } catch {
      // ignore
    }
  }, [blocks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((previous) => {
      const oldIndex = previous.findIndex((block) => block.id === active.id);
      const newIndex = previous.findIndex((block) => block.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return previous;
      return arrayMove(previous, oldIndex, newIndex);
    });
  }

  function resizeBlock(id: string, delta: { w?: number; h?: number }) {
    setBlocks((previous) => previous.map((block) => {
      if (block.id !== id) return block;
      const meta = BLOCK_META[block.type];
      return {
        ...block,
        w: clamp(block.w + (delta.w ?? 0), meta.minW, 12),
        h: clamp(block.h + (delta.h ?? 0), meta.minH, 8),
      };
    }));
  }

  function removeBlock(id: string) {
    setBlocks((previous) => previous.filter((block) => block.id !== id));
  }

  function addBlock(type: BlockType) {
    setBlocks((previous) => {
      const meta = BLOCK_META[type];
      return [...previous, { id: `${type}-${Date.now()}`, type, w: meta.defaultW, h: meta.defaultH }];
    });
  }

  const usedTypes = new Set(blocks.map((block) => block.type));
  const addableTypes = (Object.keys(BLOCK_META) as BlockType[]).filter((type) => !usedTypes.has(type));

  function renderBlockContent(type: BlockType) {
    if (type === 'stats') return <StatsBlock stats={stats} />;
    if (type === 'tasks') return <TasksBlock tasks={atRiskTasks} />;
    if (type === 'clients') return <ClientsBlock clients={activeClients} />;
    if (type === 'calendar') return <CalendarBlock scheduled={scheduled} />;
    if (type === 'notes') return <NotesBlock />;
    if (type === 'table') return <TableBlock activities={activities} recentAssets={recentAssets} />;
    return <ChartBlock trends={trends} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div>
          <h1 className="text-xl font-bold">Workspace Canvas</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Drag, resize, add, and remove blocks to shape your own dashboard.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {addableTypes.map((type) => (
            <button key={type} type="button" onClick={() => addBlock(type)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <Plus size={14} />
              {BLOCK_META[type].title.replace(' Block', '')}
            </button>
          ))}
          <button type="button" onClick={() => setBlocks(DEFAULT_BLOCKS)} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            Reset layout
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((block) => block.id)} strategy={rectSortingStrategy}>
          <div className="grid min-w-0 gap-4 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(12, minmax(70px, 1fr))', gridAutoRows: '86px' }}>
            {blocks.map((block) => (
              <WorkspaceBlock key={block.id} block={block} onResize={resizeBlock} onRemove={removeBlock}>
                {renderBlockContent(block.type)}
              </WorkspaceBlock>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

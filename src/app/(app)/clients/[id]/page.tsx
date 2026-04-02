'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, Globe } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { useLang } from '@/lib/lang-context';
import Badge from '@/components/ui/Badge';
import type { Client, Task, ContentItem, Asset } from '@/lib/types';

const tabs = ['overview', 'tasks', 'content', 'assets', 'approvals', 'activity'] as const;

const statusVariant = (s: string) => {
  if (s === 'active')  return 'success' as const;
  if (s === 'inactive') return 'default' as const;
  return 'info' as const;
};

const taskStatusVariant = (s: string) => {
  if (s === 'done') return 'success' as const;
  if (s === 'overdue') return 'danger' as const;
  return 'info' as const;
};

export default function ClientWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLang();
  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [c, tk, ct, a] = await Promise.allSettled([
          pb.collection('clients').getOne(id),
          pb.collection('tasks').getList(1, 50, { filter: `client = "${id}"`, sort: '-created' }),
          pb.collection('content').getList(1, 50, { filter: `client = "${id}"`, sort: '-created' }),
          pb.collection('assets').getList(1, 50, { filter: `client = "${id}"`, sort: '-created' }),
        ]);
        if (c.status === 'fulfilled')  setClient(c.value as unknown as Client);
        if (tk.status === 'fulfilled') setTasks(tk.value.items as unknown as Task[]);
        if (ct.status === 'fulfilled') setContent(ct.value.items as unknown as ContentItem[]);
        if (a.status === 'fulfilled')  setAssets(a.value.items as unknown as Asset[]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p style={{ color: 'var(--text-secondary)' }}>Client not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm" style={{ color: 'var(--accent)' }}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} />{t('clients')}
      </button>

      {/* Client header */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {client.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{client.name}</h1>
              <Badge variant={statusVariant(client.status)}>{t(client.status)}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              {client.email && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Mail size={14} />{client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Phone size={14} />{client.phone}
                </span>
              )}
              {client.website && (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: 'var(--accent)' }}
                >
                  <Globe size={14} />{client.website}
                </a>
              )}
              {client.industry && (
                <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Building2 size={14} />{client.industry}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-sm font-medium transition-colors capitalize border-b-2 -mb-px"
            style={{
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              borderColor: activeTab === tab ? 'var(--accent)' : 'transparent',
            }}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {client.notes && (
              <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('notes')}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t('tasks'), value: tasks.length },
                { label: t('content'), value: content.length },
                { label: t('assets'), value: assets.length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border p-5 text-center"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noTasksYet')}</div>
            ) : tasks.map(task => (
              <div key={task.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{task.due_date}</p>
                  )}
                </div>
                <Badge variant={taskStatusVariant(task.status)}>{t(task.status)}</Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-3">
            {content.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No content yet</div>
            ) : content.map(item => (
              <div key={item.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.platform}</p>
                </div>
                <Badge>{item.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="space-y-3">
            {assets.length === 0 ? (
              <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>{t('noAssetsYet')}</div>
            ) : assets.map(a => (
              <div key={a.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.name}</p>
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'approvals' || activeTab === 'activity') && (
          <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
            No {activeTab} yet
          </div>
        )}
      </div>
    </div>
  );
}

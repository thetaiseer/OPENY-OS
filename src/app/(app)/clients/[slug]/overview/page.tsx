'use client';

import { useEffect, useState } from 'react';
import { useClientWorkspace } from '../client-context';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';

export default function ClientOverviewPage() {
  const { client, clientId } = useClientWorkspace();
  const { t } = useLang();

  const [counts, setCounts] = useState({ tasks: 0, assets: 0, content: 0, pendingApprovals: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      const [tk, ast, ct] = await Promise.allSettled([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('assets').select('id, approval_status', { count: 'exact' }).eq('client_id', clientId),
        supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ]);
      const taskCount    = tk.status === 'fulfilled'  ? (tk.value.count  ?? 0) : 0;
      const assetData    = ast.status === 'fulfilled' ? (ast.value.data  ?? []) : [];
      const contentCount = ct.status === 'fulfilled'  ? (ct.value.count  ?? 0) : 0;
      const pendingCount = assetData.filter(a => (a.approval_status ?? 'pending') === 'pending').length;
      setCounts({ tasks: taskCount, assets: assetData.length, content: contentCount, pendingApprovals: pendingCount });
      setLoading(false);
    })();
  }, [clientId]);

  if (!client) return null;

  return (
    <div className="space-y-4">
      {client.notes && (
        <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('notes')}</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border p-5 h-24 animate-pulse"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
          ))
        ) : (
          [
            { label: t('tasks'),           value: counts.tasks           },
            { label: t('assets'),          value: counts.assets          },
            { label: t('content'),         value: counts.content         },
            { label: t('pendingApprovals'), value: counts.pendingApprovals },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border p-5 text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

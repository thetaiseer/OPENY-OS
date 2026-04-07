'use client';

import { useQuery } from '@tanstack/react-query';
import { FolderOpen, CheckCircle, Clock, Eye, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import type { Asset } from '@/lib/types';

/**
 * Client read-only portal — shows their own assets and approval status.
 * Accessible by the 'client' role only (enforced via middleware).
 */
export default function PortalPage() {
  const { user } = useAuth();

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['portal-assets', user.id],
    enabled: !!user.id,
    queryFn: async () => {
      const supabase = createClient();
      // Clients see assets linked to their own email / client record
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as Asset[];
    },
    staleTime: 30_000,
  });

  const approved = assets?.filter(a => a.approval_status === 'approved') ?? [];
  const pending  = assets?.filter(a => a.approval_status === 'pending')  ?? [];
  const total    = assets?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Welcome, {user.name} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Your client portal — view your assets and approvals
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Assets',  value: total,          icon: <FolderOpen size={18} />,  color: '#6366f1' },
          { label: 'Approved',      value: approved.length, icon: <CheckCircle size={18} />, color: '#16a34a' },
          { label: 'Pending Review',value: pending.length,  icon: <Clock size={18} />,       color: '#d97706' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}18`, color: c.color }}>
              {c.icon}
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{c.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Asset list */}
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Your Assets</h2>
        {isLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : !assets?.length ? (
          <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <FolderOpen size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No assets yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your team will upload assets here</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                  <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {a.content_type} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full shrink-0"
                  style={
                    a.approval_status === 'approved'
                      ? { background: 'rgba(22,163,74,0.1)', color: '#16a34a' }
                      : a.approval_status === 'rejected'
                      ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                      : { background: 'rgba(217,119,6,0.1)', color: '#d97706' }
                  }
                >
                  {a.approval_status ?? 'Pending'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {a.view_url && (
                    <a href={a.view_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-70 transition-opacity" style={{ background: 'var(--surface-2)' }} title="View">
                      <Eye size={14} style={{ color: 'var(--text-secondary)' }} />
                    </a>
                  )}
                  {a.download_url && (
                    <a href={a.download_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-70 transition-opacity" style={{ background: 'var(--surface-2)' }} title="Download">
                      <Download size={14} style={{ color: 'var(--text-secondary)' }} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

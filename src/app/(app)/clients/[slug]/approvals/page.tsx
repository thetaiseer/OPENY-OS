'use client';

import { useEffect, useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import Badge from '@/components/ui/Badge';
import { contentTypeLabel } from '@/lib/asset-utils';
import { useClientWorkspace } from '../client-context';
import type { Asset } from '@/lib/types';

interface ApprovalRecord { id: string; title: string; status: string; created_at: string }

export default function ClientApprovalsPage() {
  const { clientId } = useClientWorkspace();
  const { toast: addToast } = useToast();

  const [pendingAssets, setPendingAssets] = useState<Asset[]>([]);
  const [approvals,     setApprovals]     = useState<ApprovalRecord[]>([]);
  const [loading,       setLoading]       = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [ast, appr] = await Promise.allSettled([
      supabase.from('assets').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100),
      supabase.from('approvals').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
    ]);
    if (ast.status === 'fulfilled' && !ast.value.error) {
      const all = (ast.value.data ?? []) as Asset[];
      setPendingAssets(all.filter(a => (a.approval_status ?? 'pending') === 'pending'));
    }
    if (appr.status === 'fulfilled' && !appr.value.error) {
      setApprovals((appr.value.data ?? []) as ApprovalRecord[]);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (assetId: string, assetName: string) => {
    const { error } = await supabase.from('assets').update({ approval_status: 'approved' }).eq('id', assetId);
    if (error) { addToast(error.message, 'error'); return; }
    await supabase.from('activities').insert({
      type: 'approve', description: `Asset "${assetName}" approved`, client_id: clientId,
    });
    setPendingAssets(prev => prev.filter(a => a.id !== assetId));
    addToast('Asset approved', 'success');
  };

  const handleReject = async (assetId: string, assetName: string) => {
    const { error } = await supabase.from('assets').update({ approval_status: 'rejected' }).eq('id', assetId);
    if (error) { addToast(error.message, 'error'); return; }
    await supabase.from('activities').insert({
      type: 'reject', description: `Asset "${assetName}" rejected`, client_id: clientId,
    });
    setPendingAssets(prev => prev.filter(a => a.id !== assetId));
    addToast('Asset rejected', 'success');
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  if (pendingAssets.length === 0 && approvals.length === 0) {
    return (
      <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>No approvals yet</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pending assets */}
      {pendingAssets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Assets Awaiting Approval
          </p>
          {pendingAssets.map(a => (
            <div
              key={a.id}
              className="flex items-center gap-4 rounded-xl border px-4 py-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {a.content_type ? contentTypeLabel(a.content_type) : 'Asset'} · {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => void handleApprove(a.id, a.name)}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                >
                  <ThumbsUp size={13} /> Approve
                </button>
                <button
                  onClick={() => void handleReject(a.id, a.name)}
                  className="flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
                >
                  <ThumbsDown size={13} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval records */}
      {approvals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Approval Records
          </p>
          {approvals.map(a => (
            <div key={a.id} className="flex items-center gap-4 rounded-xl border px-5 py-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{a.title}</p>
              </div>
              <Badge>{a.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

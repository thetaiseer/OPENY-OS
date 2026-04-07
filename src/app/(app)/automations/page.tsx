'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, CheckCircle, Clock, FolderOpen, Bell, MessageSquare, Link, Loader2, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomationRule {
  id:           string;
  name:         string;
  trigger_type: string;
  action_type:  string;
  action_config: Record<string, unknown>;
  enabled:      boolean;
  created_at:   string;
}

const TRIGGER_OPTIONS = [
  { value: 'task_completed',  label: 'Task Completed',  icon: <CheckCircle size={14} /> },
  { value: 'asset_uploaded',  label: 'Asset Uploaded',  icon: <FolderOpen size={14} /> },
  { value: 'deadline_near',   label: 'Deadline Near',   icon: <Clock size={14} /> },
];

const ACTION_OPTIONS = [
  { value: 'send_notification',   label: 'Send Notification',    icon: <Bell size={14} /> },
  { value: 'link_asset_to_client',label: 'Link Asset to Client', icon: <Link size={14} /> },
  { value: 'alert_user',          label: 'Alert User',           icon: <MessageSquare size={14} /> },
  { value: 'send_slack',          label: 'Send Slack Message',   icon: <MessageSquare size={14} /> },
];

const TRIGGER_LABEL: Record<string, string> = {
  task_completed: 'Task Completed',
  asset_uploaded: 'Asset Uploaded',
  deadline_near:  'Deadline Near',
};
const ACTION_LABEL: Record<string, string> = {
  send_notification:    'Send Notification',
  link_asset_to_client: 'Link Asset to Client',
  alert_user:           'Alert User',
  send_slack:           'Send to Slack',
};

const inputCls   = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canManage = role === 'admin' || role === 'manager';

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'task_completed',
    action_type:  'send_notification',
    message: '',
    webhook_url: '',
  });

  const { data: rules, isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await fetch('/api/automations');
      if (!res.ok) throw new Error('Failed to load automations');
      const j = await res.json() as { success: boolean; rules?: AutomationRule[] };
      return j.rules ?? [];
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const actionConfig: Record<string, string> = {};
      if (data.message)     actionConfig.message     = data.message;
      if (data.webhook_url) actionConfig.webhook_url = data.webhook_url;

      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          data.name,
          trigger_type:  data.trigger_type,
          action_type:   data.action_type,
          action_config: actionConfig,
          enabled: true,
        }),
      });
      const j = await res.json() as { success: boolean; error?: string };
      if (!j.success) throw new Error(j.error ?? 'Failed to create rule');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['automations'] });
      toast('Automation rule created!', 'success');
      setModalOpen(false);
      setForm({ name: '', trigger_type: 'task_completed', action_type: 'send_notification', message: '', webhook_url: '' });
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch(`/api/automations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const j = await res.json() as { success: boolean; error?: string };
      if (!j.success) throw new Error(j.error ?? 'Failed to update rule');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['automations'] }),
    onError: (err: Error) => toast(err.message, 'error'),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Zap size={24} style={{ color: 'var(--accent)' }} />
            Automations
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Create IF-THEN rules to automate your workflow
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={16} />New Rule
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : !rules?.length ? (
        <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Zap size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No automation rules yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Create your first rule to automate repetitive tasks</p>
          {canManage && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white mx-auto"
              style={{ background: 'var(--accent)' }}
            >
              <Plus size={16} />New Rule
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {rules.map((rule, i) => (
            <div
              key={rule.id}
              className="flex items-center gap-4 px-6 py-4 border-b last:border-b-0"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: rule.enabled ? 'var(--accent-soft)' : 'var(--surface-2)' }}
              >
                <Zap size={14} style={{ color: rule.enabled ? 'var(--accent)' : 'var(--text-secondary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{rule.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  IF <span className="font-semibold">{TRIGGER_LABEL[rule.trigger_type] ?? rule.trigger_type}</span>
                  {' → '}
                  <span className="font-semibold">{ACTION_LABEL[rule.action_type] ?? rule.action_type}</span>
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={rule.enabled
                    ? { background: 'rgba(22,163,74,0.1)', color: '#16a34a' }
                    : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  {rule.enabled ? 'Active' : 'Disabled'}
                </span>
                {canManage && (
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                    className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-70"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Automation Rule">
        <form
          onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Rule Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Notify on task completion" />
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>IF (Trigger)</p>
            <div className="grid grid-cols-1 gap-2">
              {TRIGGER_OPTIONS.map(t => (
                <label key={t.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="trigger"
                    value={t.value}
                    checked={form.trigger_type === t.value}
                    onChange={() => setForm(f => ({ ...f, trigger_type: t.value }))}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                    {t.icon}{t.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>THEN (Action)</p>
            <div className="grid grid-cols-1 gap-2">
              {ACTION_OPTIONS.map(a => (
                <label key={a.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="action"
                    value={a.value}
                    checked={form.action_type === a.value}
                    onChange={() => setForm(f => ({ ...f, action_type: a.value }))}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                    {a.icon}{a.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {(form.action_type === 'send_notification' || form.action_type === 'alert_user') && (
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Message</label>
              <input type="text" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Use {{taskId}}, {{clientId}}, {{assetId}}" />
            </div>
          )}

          {form.action_type === 'send_slack' && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Slack Webhook URL</label>
                <input type="url" value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} className={inputCls} style={inputStyle} placeholder="https://hooks.slack.com/services/…" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Message</label>
                <input type="text" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Notification message" />
              </div>
            </>
          )}

          {createMutation.isError && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{createMutation.error?.message ?? 'Failed to create rule'}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

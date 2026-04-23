'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Zap, ToggleLeft, ToggleRight, Pencil, Trash2, Check } from 'lucide-react';
import type { AutomationRule } from '@/lib/types';
import FormModal from '@/components/ui/FormModal';

const TRIGGER_TYPES = [
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.status_changed', label: 'Task Status Changed' },
  { value: 'task.overdue', label: 'Task Becomes Overdue' },
  { value: 'asset.uploaded', label: 'Asset Uploaded' },
  { value: 'content.published', label: 'Content Published' },
  { value: 'client.created', label: 'Client Created' },
  { value: 'project.created', label: 'Project Created' },
];

async function fetchRules(): Promise<AutomationRule[]> {
  const res = await fetch('/api/automations');
  const json = (await res.json()) as { success: boolean; rules: AutomationRule[] };
  if (!json.success) throw new Error('Failed to load rules');
  return json.rules;
}

export default function AutomationsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['automations'],
    queryFn: fetchRules,
  });

  const openCreate = () => {
    setEditRule(null);
    setForm({ name: '', description: '', trigger_type: '', is_active: true });
    setSaveErr(null);
    setModalOpen(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditRule(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? '',
      trigger_type: rule.trigger_type,
      is_active: rule.is_active,
    });
    setSaveErr(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const url = editRule ? `/api/automations/${editRule.id}` : '/api/automations';
      const method = editRule ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, conditions: [], actions: [] }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      setModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    await fetch(`/api/automations/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    void queryClient.invalidateQueries({ queryKey: ['automations'] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation rule?')) return;
    await fetch(`/api/automations/${id}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['automations'] });
  };

  const triggerLabel = (type: string) => TRIGGER_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Automations
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Rule-based automations — trigger + conditions + actions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} /> New Rule
        </button>
      </div>

      {/* Rules */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : rules.length === 0 ? (
        <div className="py-20 text-center">
          <Zap
            size={40}
            className="mx-auto mb-3 opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No automations yet. Create your first rule!
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs" style={{ color: 'var(--text-secondary)' }}>
            Example: &ldquo;When task status = Done → send notification&rdquo;
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-4 rounded-2xl border p-4"
              style={{
                background: 'var(--surface)',
                borderColor: rule.is_active ? 'var(--border)' : 'var(--border)',
                opacity: rule.is_active ? 1 : 0.65,
              }}
            >
              {/* Icon */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: rule.is_active ? 'var(--accent-soft)' : 'var(--surface-2)' }}
              >
                <Zap
                  size={16}
                  style={{ color: rule.is_active ? 'var(--accent)' : 'var(--text-secondary)' }}
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {rule.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Trigger: {triggerLabel(rule.trigger_type)}
                  {rule.run_count > 0 && <span className="ml-2">· Ran {rule.run_count}×</span>}
                </p>
                {rule.description && (
                  <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {rule.description}
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => void handleToggle(rule)}
                  className="transition-colors"
                  title={rule.is_active ? 'Disable' : 'Enable'}
                  style={{ color: rule.is_active ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  {rule.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button
                  onClick={() => openEdit(rule)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => void handleDelete(rule.id)}
                  className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <FormModal
          open
          onClose={() => setModalOpen(false)}
          title={editRule ? 'Edit Rule' : 'New Automation Rule'}
          icon={<Zap size={15} />}
          size="sm"
          onSubmit={(e) => void handleSave(e)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="openy-modal-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="openy-modal-btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Check size={14} /> Save
                  </>
                )}
              </button>
            </>
          }
        >
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Rule Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Mark overdue tasks"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Trigger *
            </label>
            <select
              required
              value={form.trigger_type}
              onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              <option value="">— Select trigger —</option>
              {TRIGGER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description…"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              Active (run this rule)
            </span>
          </label>

          <div
            className="rounded-xl p-3 text-xs"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            💡 Conditions and actions editor coming soon. Rules are saved and ready to use.
          </div>

          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
        </FormModal>
      )}
    </div>
  );
}

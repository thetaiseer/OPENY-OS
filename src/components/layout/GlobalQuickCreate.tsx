'use client';

/**
 * Opens create flows in modals when quick actions / FAB are used from any page,
 * instead of redirecting to another route.
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileText } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useQuickActions } from '@/context/quick-actions-context';
import { useAuth } from '@/context/auth-context';
import { useLang } from '@/context/lang-context';
import { useToast } from '@/context/toast-context';
import { useUpload } from '@/context/upload-context';
import { useAppPeriod } from '@/context/app-period-context';
import { consumePendingQuickAction } from '@/lib/pending-quick-action';
import { MAIN_CATEGORIES } from '@/lib/asset-utils';
import { isImage as isImageFile } from '@/components/ui/AssetsGrid';
import type { Client, Project, TeamMember } from '@/lib/types';
import CreateClientModal from '@/components/features/upload/CreateClientModal';
import NewTaskModal from '@/components/tasks/NewTaskModal';
import NewContentModal from '@/components/content/NewContentModal';
import AppModal from '@/components/ui/AppModal';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FormModal from '@/components/ui/FormModal';
import { Input, Textarea, Field } from '@/components/ui/Input';
import SelectDropdown from '@/components/ui/SelectDropdown';

type ProjectStatus = Project['status'];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function nextFileId() {
  return crypto.randomUUID();
}
function getFileExtension(name: string): string {
  const p = name.split('.');
  return p.length > 1 ? `.${p.pop()!.toLowerCase()}` : '';
}
function getFileBaseName(name: string): string {
  const ext = getFileExtension(name);
  return ext ? name.slice(0, name.length - ext.length) : name;
}
function makePreviewUrl(file: File): string | null {
  return isImageFile(file.name, file.type) ? URL.createObjectURL(file) : null;
}

export default function GlobalQuickCreate() {
  const { fallbackAction, clearFallbackAction, triggerQuickAction } = useQuickActions();
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const canManage =
    role === 'owner' || role === 'admin' || role === 'manager' || role === 'team_member';

  useEffect(() => {
    if (fallbackAction && !canManage) clearFallbackAction();
  }, [fallbackAction, canManage, clearFallbackAction]);

  useEffect(() => {
    const pending = consumePendingQuickAction();
    if (pending) triggerQuickAction(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on shell mount for deep-link queue
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ['global-quick-clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as Client[];
    },
    enabled: Boolean(fallbackAction),
    staleTime: 60_000,
  });

  const { data: team = [] } = useQuery({
    queryKey: ['global-quick-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, full_name, profile_id')
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as TeamMember[];
    },
    enabled: fallbackAction === 'add-task',
    staleTime: 60_000,
  });

  const onCreatedInvalidate = useCallback(
    (keys: string[][]) => {
      clearFallbackAction();
      for (const key of keys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    [clearFallbackAction, queryClient],
  );

  if (!fallbackAction || !canManage) return null;

  if (fallbackAction === 'add-client') {
    return (
      <CreateClientModal
        onCreated={() => {
          onCreatedInvalidate([
            ['clients-list'],
            ['global-quick-clients'],
            ['projects-clients-picker'],
          ]);
        }}
        onCancel={clearFallbackAction}
      />
    );
  }

  if (fallbackAction === 'add-task') {
    return (
      <NewTaskModal
        open={true}
        onClose={clearFallbackAction}
        onCreated={() => {
          onCreatedInvalidate([
            ['tasks-all'],
            ['tasks-my'],
            ['dashboard-upcoming-tasks'],
            ['dashboard-overdue-tasks'],
          ]);
        }}
        clients={clients}
        team={team}
      />
    );
  }

  if (fallbackAction === 'add-content') {
    return (
      <NewContentModal
        open={true}
        onClose={clearFallbackAction}
        clients={clients}
        onCreated={() => {
          onCreatedInvalidate([['content-items'], ['content']]);
        }}
      />
    );
  }

  if (fallbackAction === 'add-note') {
    return (
      <GlobalNoteModal
        onClose={clearFallbackAction}
        onSaved={() => onCreatedInvalidate([['notes']])}
      />
    );
  }

  if (fallbackAction === 'add-project') {
    return (
      <GlobalProjectModal
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        onClose={clearFallbackAction}
        onSaved={() =>
          onCreatedInvalidate([['projects-all'], ['projects'], ['dashboard-projects-mini']])
        }
      />
    );
  }

  if (fallbackAction === 'add-asset') {
    return <GlobalQuickUploadModal clients={clients} onClose={clearFallbackAction} />;
  }

  return null;
}

function GlobalNoteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      onSaved();
      onClose();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title="New Note"
      icon={<FileText size={15} />}
      size="md"
      onSubmit={(e) => void handleSave(e)}
      footer={
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary">
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
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Title
        </label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title…"
          className="h-9 w-full rounded-lg px-3 text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Write your note here…"
          className="w-full resize-y rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />
      </div>
      {saveErr ? <p className="text-xs text-red-500">{saveErr}</p> : null}
    </FormModal>
  );
}

function GlobalProjectModal({
  clients,
  onClose,
  onSaved,
}: {
  clients: Pick<Client, 'id' | 'name'>[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
    client_id: clients[0]?.id ?? '',
    start_date: '',
    end_date: '',
    color: '#6366f1',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) {
      setSaveErr('Please select a client.');
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
          client_id: form.client_id,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          color: form.color,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      onSaved();
      onClose();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('newProject')}
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" form="global-project-form" disabled={saving}>
            {saving ? t('loading') : t('save')}
          </Button>
        </>
      }
    >
      <form id="global-project-form" onSubmit={handleSave} className="space-y-4">
        {saveErr ? (
          <p
            className="rounded-xl px-3 py-2 text-sm"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
          >
            {saveErr}
          </p>
        ) : null}
        <Field label="Client">
          <SelectDropdown
            fullWidth
            value={form.client_id}
            onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
            options={[
              { value: '', label: 'Select client' },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </Field>
        <Field label="Name" id="gq-project-name">
          <Input
            id="gq-project-name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Status">
            <SelectDropdown
              fullWidth
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}
              options={(
                ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as ProjectStatus[]
              ).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </Field>
          <Field label="Color" id="gq-project-color">
            <input
              id="gq-project-color"
              type="color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="h-10 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"
            />
          </Field>
          <Field label="Start" id="gq-project-start">
            <Input
              id="gq-project-start"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            />
          </Field>
          <Field label="End" id="gq-project-end">
            <Input
              id="gq-project-end"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function GlobalQuickUploadModal({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startBatch } = useUpload();
  const { periodYm } = useAppPeriod();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [files, setFiles] = useState<File[]>([]);

  const clientName = clients.find((c) => c.id === clientId)?.name ?? '';

  const handleQueue = (list: File[]) => {
    if (!list.length) return;
    setFiles((prev) => [...prev, ...list]);
  };

  const handleSubmit = () => {
    if (!clientId) {
      toast('Select a client', 'error');
      return;
    }
    if (!files.length) {
      toast('Choose at least one file', 'error');
      return;
    }
    const monthKey = periodYm;
    const mainCategory = MAIN_CATEGORIES[0]?.slug ?? 'general';
    const uploadedBy = user?.name || user?.email || null;
    const uploadedByEmail = user?.email || null;

    const items = files.map((file) => ({
      id: nextFileId(),
      file,
      previewUrl: makePreviewUrl(file),
      uploadName: getFileBaseName(file.name),
    }));

    startBatch(items, {
      clientName,
      clientId,
      contentType: '',
      mainCategory,
      subCategory: '',
      monthKey,
      uploadedBy,
      uploadedByEmail,
    });
    toast(`${items.length} file${items.length !== 1 ? 's' : ''} queued for upload`, 'success');
    onClose();
  };

  return (
    <AppModal
      open
      onClose={onClose}
      title="Upload files"
      size="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit}>
            Start upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Client">
          <SelectDropdown
            fullWidth
            value={clientId}
            onChange={setClientId}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <div>
          <label className="mb-1 block text-sm font-medium text-primary">Files</label>
          <input
            type="file"
            multiple
            className="w-full text-sm"
            onChange={(e) => {
              handleQueue(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          {files.length > 0 ? (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-secondary">
              {files.map((f) => (
                <li key={f.name + f.size}>{f.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </AppModal>
  );
}

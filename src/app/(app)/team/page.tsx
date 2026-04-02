'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Pencil, Trash2, Mail, Briefcase } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import type { TeamMember } from '@/lib/types';

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

const blankForm = { name: '', email: '', role: '' };

export default function TeamPage() {
  const { t } = useLang();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ ...blankForm });
  const [editForm, setEditForm] = useState({ ...blankForm });

  const fetchMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('team_members').select('*').order('name');
      if (!error) setMembers((data ?? []) as TeamMember[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('team_members').insert({
        name: form.name.trim(),
        email: form.email || null,
        role: form.role || null,
      });
      if (error) throw error;
      setCreateOpen(false);
      setForm({ ...blankForm });
      fetchMembers();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[team create]', err);
      alert(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (member: TeamMember) => {
    setEditForm({ name: member.name, email: member.email ?? '', role: member.role ?? '' });
    setEditMember(member);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('team_members').update({
        name: editForm.name.trim(),
        email: editForm.email || null,
        role: editForm.role || null,
      }).eq('id', editMember.id);
      if (error) throw error;
      setEditMember(null);
      fetchMembers();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[team edit]', err);
      alert(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMember) return;
    const { error } = await supabase.from('team_members').delete().eq('id', deleteMember.id);
    if (error) { alert(error.message); return; }
    setMembers(prev => prev.filter(m => m.id !== deleteMember.id));
    setDeleteMember(null);
  };

  const MemberForm = ({ f, setF }: { f: typeof blankForm; setF: React.Dispatch<React.SetStateAction<typeof blankForm>> }) => (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('fullName')} *</label>
        <input required value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Team member name" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('email')}</label>
        <input type="email" value={f.email} onChange={e => setF(x => ({ ...x, email: e.target.value }))} className={inputCls} style={inputStyle} placeholder="email@company.com" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('role')}</label>
        <input value={f.role} onChange={e => setF(x => ({ ...x, role: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Designer, Manager, etc." />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('team')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} />{t('newMember')}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('noTeamMembers')}
          description={t('noTeamMembersDesc')}
          action={
            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
              <Plus size={16} />{t('newMember')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(m => (
            <div
              key={m.id}
              className="rounded-xl border p-5 flex items-start gap-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.name}</p>
                {m.role && (
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <Briefcase size={11} />{m.role}
                  </p>
                )}
                {m.email && (
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <Mail size={11} />{m.email}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--text-secondary)' }}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => setDeleteMember(m)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('newMember')} size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <MemberForm f={form} setF={setForm} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>{saving ? t('loading') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Edit Member" size="sm">
        <form onSubmit={handleEdit} className="space-y-4">
          <MemberForm f={editForm} setF={setEditForm} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditMember(null)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>{saving ? t('loading') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleteMember} onClose={() => setDeleteMember(null)} title="Remove Member" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text)' }}>Remove <strong>{deleteMember?.name}</strong> from the team? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteMember(null)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="button" onClick={handleDelete} className="h-9 px-4 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">Remove</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


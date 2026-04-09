'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Plus, Pencil, Trash2, Mail, Briefcase,
  Send, RotateCcw, XCircle, Link2, Clock, CheckCircle,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import type { TeamMember, TeamInvitation } from '@/lib/types';

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

const blankForm = { name: '', email: '', role: '' };

// ── MemberForm is defined at module scope so React never remounts it ─────────
function MemberForm({
  f,
  setF,
}: {
  f: typeof blankForm;
  setF: React.Dispatch<React.SetStateAction<typeof blankForm>>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Full Name *</label>
        <input
          required
          value={f.name}
          onChange={e => setF(x => ({ ...x, name: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Team member name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Email</label>
        <input
          type="email"
          value={f.email}
          onChange={e => setF(x => ({ ...x, email: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="email@company.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Role</label>
        <input
          value={f.role}
          onChange={e => setF(x => ({ ...x, role: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Designer, Manager, etc."
        />
      </div>
    </div>
  );
}

// ── InviteForm is also at module scope ───────────────────────────────────────
function InviteForm({
  f,
  setF,
}: {
  f: typeof blankForm;
  setF: React.Dispatch<React.SetStateAction<typeof blankForm>>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Full Name *</label>
        <input
          required
          value={f.name}
          onChange={e => setF(x => ({ ...x, name: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Team member name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Email *</label>
        <input
          required
          type="email"
          value={f.email}
          onChange={e => setF(x => ({ ...x, email: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="email@company.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Role *</label>
        <input
          required
          value={f.role}
          onChange={e => setF(x => ({ ...x, role: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Designer, Manager, etc."
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        An invitation email will be sent automatically. The link expires in 7 days.
      </p>
    </div>
  );
}

// ── Invite status badge ───────────────────────────────────────────────────────
function InviteBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    invited:  { label: 'Invited',   color: '#d97706', bg: '#fffbeb' },
    accepted: { label: 'Active',    color: '#16a34a', bg: '#f0fdf4' },
    expired:  { label: 'Expired',   color: '#9ca3af', bg: '#f9fafb' },
    revoked:  { label: 'Revoked',   color: '#dc2626', bg: '#fef2f2' },
  };
  const c = cfg[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { t } = useLang();
  const { role: myRole } = useAuth();
  const canManage = myRole === 'admin' || myRole === 'manager';

  const [members, setMembers]           = useState<TeamMember[]>([]);
  const [invitations, setInvitations]   = useState<TeamInvitation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [actionError, setActionError]   = useState('');

  // Modals
  const [inviteOpen, setInviteOpen]     = useState(false);
  const [editMember, setEditMember]     = useState<TeamMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);

  // Forms — all at the top level, never re-created during render
  const [inviteForm, setInviteForm]     = useState({ ...blankForm });
  const [editForm, setEditForm]         = useState({ ...blankForm });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        supabase.from('team_members').select('*').order('name'),
        supabase.from('team_invitations').select('*').order('created_at', { ascending: false }),
      ]);
      if (!membersRes.error)  setMembers((membersRes.data  ?? []) as TeamMember[]);
      if (!invitesRes.error)  setInvitations((invitesRes.data ?? []) as TeamInvitation[]);
    } catch (err) {
      console.error('[team] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Latest invitation per member (for status display)
  const inviteByMember = useCallback((memberId: string): TeamInvitation | undefined => {
    return invitations.find(i => i.team_member_id === memberId);
  }, [invitations]);

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.role.trim()) {
      setActionError('Name, email, and role are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/team/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(inviteForm),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? 'Failed to send invitation.'); return; }
      setInviteOpen(false);
      setInviteForm({ ...blankForm });
      fetchData();
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
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
        name:  editForm.name.trim(),
        email: editForm.email || null,
        role:  editForm.role || null,
      }).eq('id', editMember.id);
      if (error) throw error;
      setEditMember(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteMember) return;
    const { error } = await supabase.from('team_members').delete().eq('id', deleteMember.id);
    if (error) { alert(error.message); return; }
    setMembers(prev => prev.filter(m => m.id !== deleteMember.id));
    setDeleteMember(null);
  };

  // ── Resend invite ─────────────────────────────────────────────────────────
  const handleResend = async (member: TeamMember) => {
    try {
      const res = await fetch('/api/team/invite/resend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ team_member_id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? 'Failed to resend invitation.'); return; }
      alert(`Invitation resent to ${member.email}`);
      fetchData();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  // ── Revoke invite ─────────────────────────────────────────────────────────
  const handleRevoke = async (member: TeamMember) => {
    if (!confirm(`Revoke invitation for ${member.name}? This will remove them from the team list.`)) return;
    try {
      const res = await fetch('/api/team/invite/revoke', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ team_member_id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? 'Failed to revoke invitation.'); return; }
      fetchData();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  // ── Copy invite link ──────────────────────────────────────────────────────
  const handleCopyLink = async (member: TeamMember) => {
    const inv = inviteByMember(member.id);
    if (!inv) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const link   = `${appUrl}/invite/${inv.token}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Invite link copied to clipboard!');
    } catch {
      prompt('Copy this invite link:', link);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const activeMembers  = members.filter(m => !m.status || m.status === 'active');
  const invitedMembers = members.filter(m => m.status === 'invited');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('team')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {activeMembers.length} active · {invitedMembers.length} pending
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setActionError(''); setInviteOpen(true); }}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--accent)' }}
          >
            <Send size={15} />Invite Member
          </button>
        )}
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
            canManage ? (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Send size={15} />Invite Member
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Active members */}
          {activeMembers.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <CheckCircle size={14} />Active Members
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeMembers.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    invitation={inviteByMember(m.id)}
                    canManage={canManage}
                    onEdit={openEdit}
                    onDelete={setDeleteMember}
                    onResend={handleResend}
                    onRevoke={handleRevoke}
                    onCopyLink={handleCopyLink}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Invited / pending members */}
          {invitedMembers.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Clock size={14} />Pending Invitations
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {invitedMembers.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    invitation={inviteByMember(m.id)}
                    canManage={canManage}
                    onEdit={openEdit}
                    onDelete={setDeleteMember}
                    onResend={handleResend}
                    onRevoke={handleRevoke}
                    onCopyLink={handleCopyLink}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────────────── */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member" size="sm">
        <form onSubmit={handleInvite} className="space-y-4">
          <InviteForm f={inviteForm} setF={setInviteForm} />
          {actionError && (
            <p className="text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">{actionError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setInviteOpen(false)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60 flex items-center gap-2" style={{ background: 'var(--accent)' }}>
              <Send size={14} />{saving ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Edit Member" size="sm">
        <form onSubmit={handleEdit} className="space-y-4">
          <MemberForm f={editForm} setF={setEditForm} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditMember(null)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>{saving ? t('loading') : t('save')}</button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Modal open={!!deleteMember} onClose={() => setDeleteMember(null)} title="Remove Member" size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Remove <strong>{deleteMember?.name}</strong> from the team? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteMember(null)} className="h-9 px-4 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>{t('cancel')}</button>
            <button type="button" onClick={handleDelete} className="h-9 px-4 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">Remove</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Member card component (at module scope) ───────────────────────────────────
function MemberCard({
  member,
  invitation,
  canManage,
  onEdit,
  onDelete,
  onResend,
  onRevoke,
  onCopyLink,
}: {
  member: TeamMember;
  invitation?: TeamInvitation;
  canManage: boolean;
  onEdit: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
  onResend: (m: TeamMember) => void;
  onRevoke: (m: TeamMember) => void;
  onCopyLink: (m: TeamMember) => void;
}) {
  const isInvited = member.status === 'invited';

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{
        background:   'var(--surface)',
        borderColor:  isInvited ? 'var(--accent)' : 'var(--border)',
        opacity:      isInvited ? 0.92 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: isInvited ? '#d97706' : 'var(--accent)' }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{member.name}</p>
            {isInvited && <InviteBadge status="invited" />}
          </div>
          {member.role && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Briefcase size={11} />{member.role}
            </p>
          )}
          {member.email && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Mail size={11} />{member.email}
            </p>
          )}
          {invitation && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Invited {new Date(invitation.created_at).toLocaleDateString()}
              {invitation.expires_at && ` · expires ${new Date(invitation.expires_at).toLocaleDateString()}`}
            </p>
          )}
        </div>
        {canManage && !isInvited && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(member)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--text-secondary)' }}>
              <Pencil size={13} />
            </button>
            <button onClick={() => onDelete(member)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Invite actions row */}
      {canManage && isInvited && (
        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => onResend(member)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Resend invitation"
          >
            <RotateCcw size={12} />Resend
          </button>
          <button
            onClick={() => onCopyLink(member)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Copy invite link"
          >
            <Link2 size={12} />Copy Link
          </button>
          <button
            onClick={() => onRevoke(member)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-400 ml-auto"
            title="Revoke invitation"
          >
            <XCircle size={12} />Revoke
          </button>
        </div>
      )}
    </div>
  );
}


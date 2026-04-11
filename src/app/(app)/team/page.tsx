'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Plus, Pencil, Trash2, Mail, Briefcase,
  Send, RotateCcw, XCircle, Link2, Clock, CheckCircle,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { canManageMembers } from '@/lib/rbac';
import EmptyState from '@/components/ui/EmptyState';
import AccessDenied from '@/components/ui/AccessDenied';
import Modal from '@/components/ui/Modal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { TeamMember, TeamInvitation } from '@/lib/types';

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

// ── Job titles list ───────────────────────────────────────────────────────────
const JOB_TITLE_OPTIONS = [
  { value: 'Graphic Designer',       label: 'Graphic Designer' },
  { value: 'Social Media Manager',   label: 'Social Media Manager' },
  { value: 'Content Creator',        label: 'Content Creator' },
  { value: 'Video Editor',           label: 'Video Editor' },
  { value: 'Media Buyer',            label: 'Media Buyer' },
  { value: 'Copywriter',             label: 'Copywriter' },
  { value: 'Community Manager',      label: 'Community Manager' },
  { value: 'Account Manager',        label: 'Account Manager' },
  { value: 'SEO Specialist',         label: 'SEO Specialist' },
  { value: 'Performance Marketer',   label: 'Performance Marketer' },
  { value: 'Email Marketing Specialist', label: 'Email Marketing Specialist' },
  { value: 'Brand Strategist',       label: 'Brand Strategist' },
  { value: 'UX/UI Designer',         label: 'UX/UI Designer' },
  { value: 'Photographer',           label: 'Photographer' },
  { value: 'Influencer Manager',     label: 'Influencer Manager' },
  { value: 'PR Specialist',          label: 'PR Specialist' },
  { value: 'Analytics Specialist',   label: 'Analytics Specialist' },
  { value: 'Project Manager',        label: 'Project Manager' },
  { value: '__other__',              label: 'Other…' },
];

// ── Access role options (permission roles only) ───────────────────────────────
const ACCESS_ROLE_OPTIONS = [
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member',  label: 'Member' },
  { value: 'viewer',  label: 'Viewer' },
];

// ── JobTitleField — dropdown + optional custom text input ─────────────────────
function JobTitleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isPreset = JOB_TITLE_OPTIONS.some(o => o.value === value && o.value !== '__other__');
  const [dropVal, setDropVal] = useState(isPreset ? value : (value ? '__other__' : ''));
  const [customVal, setCustomVal] = useState(isPreset ? '' : value);

  const handleDropChange = (v: string) => {
    setDropVal(v);
    if (v === '__other__') {
      onChange(customVal);
    } else {
      setCustomVal('');
      onChange(v);
    }
  };

  const handleCustomChange = (v: string) => {
    setCustomVal(v);
    onChange(v);
  };

  return (
    <div className="space-y-2">
      <SelectDropdown
        value={dropVal}
        onChange={handleDropChange}
        options={JOB_TITLE_OPTIONS}
        placeholder="Select job title…"
        fullWidth
        clearable
      />
      {dropVal === '__other__' && (
        <input
          type="text"
          value={customVal}
          onChange={e => handleCustomChange(e.target.value)}
          className={inputCls}
          style={inputStyle}
          placeholder="Enter custom job title"
          autoFocus
        />
      )}
    </div>
  );
}

const blankForm = { full_name: '', email: '', permission_role: 'member', job_title: '' };

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
          value={f.full_name}
          onChange={e => setF(x => ({ ...x, full_name: e.target.value }))}
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
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Access Role</label>
        <SelectDropdown
          value={f.permission_role}
          onChange={v => setF(x => ({ ...x, permission_role: v }))}
          options={ACCESS_ROLE_OPTIONS}
          placeholder="Select access role…"
          fullWidth
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Job Title</label>
        <JobTitleField value={f.job_title} onChange={v => setF(x => ({ ...x, job_title: v }))} />
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
          value={f.full_name}
          onChange={e => setF(x => ({ ...x, full_name: e.target.value }))}
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
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Access Role *</label>
        <SelectDropdown
          value={f.permission_role}
          onChange={v => setF(x => ({ ...x, permission_role: v }))}
          options={ACCESS_ROLE_OPTIONS}
          placeholder="Select access role…"
          fullWidth
        />
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Controls what the member can see and do in the workspace.
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Job Title *</label>
        <JobTitleField value={f.job_title} onChange={v => setF(x => ({ ...x, job_title: v }))} />
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Their actual role on the team (e.g., Graphic Designer).
        </p>
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
  const { role: myRole, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const canManage = canManageMembers(myRole);

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
        supabase.from('team_members').select('*').order('full_name'),
        supabase.from('team_invitations').select('*').order('created_at', { ascending: false }),
      ]);
      if (membersRes.error) console.error('[team] members fetch error:', membersRes.error.message);
      else setMembers((membersRes.data ?? []) as TeamMember[]);
      if (invitesRes.error) console.error('[team] invitations fetch error:', invitesRes.error.message);
      else setInvitations((invitesRes.data ?? []) as TeamInvitation[]);
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

  // Show access denied for member/viewer (after all hooks)
  if (!authLoading && !canManage) {
    return <AccessDenied message="Only owners and admins can access the Team management page." />;
  }

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (!inviteForm.full_name.trim()) { setActionError('Full name is required.'); return; }
    if (!inviteForm.email.trim())     { setActionError('Email is required.'); return; }
    if (!inviteForm.permission_role)  { setActionError('Access role is required.'); return; }
    if (!inviteForm.job_title.trim()) { setActionError('Job title is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/team/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          full_name:       inviteForm.full_name,
          email:           inviteForm.email,
          permission_role: inviteForm.permission_role,
          job_title:       inviteForm.job_title,
        }),
      });
      let data: { error?: string } = {};
      try { data = await res.json(); } catch (jsonErr) {
        console.error('[team/invite] Failed to parse response JSON:', jsonErr);
      }
      if (!res.ok) {
        console.error('[team/invite] API error:', res.status, data.error);
        setActionError(data.error ?? `Request failed (${res.status}). Please try again.`);
        return;
      }
      setInviteOpen(false);
      setInviteForm({ ...blankForm });
      toast(`Invitation sent to ${inviteForm.email}`, 'success');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error. Please check your connection and try again.';
      console.error('[team/invite] fetch error:', err);
      setActionError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (member: TeamMember) => {
    setEditForm({
      full_name:       member.full_name,
      email:           member.email ?? '',
      permission_role: member.permission_role ?? 'member',
      job_title:       member.job_title ?? member.role ?? '',
    });
    setEditMember(member);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/team/members/${editMember.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          full_name:       editForm.full_name.trim(),
          email:           editForm.email || null,
          permission_role: editForm.permission_role || null,
          job_title:       editForm.job_title || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update member');
      setEditMember(null);
      toast('Member updated successfully', 'success');
      fetchData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update member', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteMember) return;
    try {
      const res = await fetch(`/api/team/members/${deleteMember.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Failed to remove member', 'error'); return; }
      setMembers(prev => prev.filter(m => m.id !== deleteMember.id));
      setDeleteMember(null);
      toast('Member removed', 'info');
    } catch {
      toast('Network error. Please try again.', 'error');
    }
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
      if (!res.ok) { toast(data.error ?? 'Failed to resend invitation.', 'error'); return; }
      toast(`Invitation resent to ${member.email}`, 'success');
      fetchData();
    } catch {
      toast('Network error. Please try again.', 'error');
    }
  };

  // ── Revoke invite ─────────────────────────────────────────────────────────
  const handleRevoke = async (member: TeamMember) => {
    if (!confirm(`Revoke invitation for ${member.full_name}? This will remove them from the team list.`)) return;
    try {
      const res = await fetch('/api/team/invite/revoke', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ team_member_id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? 'Failed to revoke invitation.', 'error'); return; }
      toast('Invitation revoked', 'info');
      fetchData();
    } catch {
      toast('Network error. Please try again.', 'error');
    }
  };

  // ── Copy invite link ──────────────────────────────────────────────────────
  const handleCopyLink = async (member: TeamMember) => {
    const inv = inviteByMember(member.id);
    if (!inv) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const link   = `${appUrl}/invite?token=${inv.token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied to clipboard!', 'success');
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
            Remove <strong>{deleteMember?.full_name}</strong> from the team? This cannot be undone.
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
          {member.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{member.full_name}</p>
            {isInvited && <InviteBadge status="invited" />}
          </div>
          {/* Job title and permission role displayed separately */}
          {(member.job_title ?? member.role) && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Briefcase size={11} />{member.job_title ?? member.role}
            </p>
          )}
          {member.permission_role && (
            <p className="text-xs flex items-center gap-1 mt-0.5 capitalize" style={{ color: 'var(--text-secondary)' }}>
              <Users size={11} />{member.permission_role}
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

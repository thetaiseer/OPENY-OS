'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Pencil, Trash2, Mail, Briefcase,
  Send, RotateCcw, XCircle, Link2, Clock, CheckCircle, Crown,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { TeamMember, TeamInvitation } from '@/lib/types';
import { getWorkspaceLabel, WORKSPACE_ROLES } from '@/lib/workspace-access';

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

// ── System access roles ───────────────────────────────────────────────────────
// These are the valid values for team_members.role (access control).
// 'owner' is intentionally excluded — ownership cannot be granted via invitation.
const ACCESS_ROLE_VALUES = ['owner', 'admin', 'manager', 'team_member', 'viewer', 'client'] as const;

const ACCESS_ROLE_OPTIONS = [
  { value: 'admin',       label: 'Admin — full access' },
  { value: 'manager',     label: 'Manager — manage tasks & team' },
  { value: 'team_member', label: 'Team Member — standard access' },
  { value: 'viewer',      label: 'Viewer — read-only access' },
];

const WORKSPACE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

// ── Marketing roles list (job titles) ────────────────────────────────────────
// Stored in team_members.job_title — separate from the access role.
const JOB_TITLE_OPTIONS = [
  { value: 'Content Creator',           label: 'Content Creator' },
  { value: 'Social Media Manager',      label: 'Social Media Manager' },
  { value: 'Graphic Designer',          label: 'Graphic Designer' },
  { value: 'Video Editor',              label: 'Video Editor' },
  { value: 'Copywriter',                label: 'Copywriter' },
  { value: 'SEO Specialist',            label: 'SEO Specialist' },
  { value: 'Paid Ads Specialist',       label: 'Paid Ads Specialist' },
  { value: 'Email Marketing Specialist',label: 'Email Marketing Specialist' },
  { value: 'Brand Strategist',          label: 'Brand Strategist' },
  { value: 'Marketing Manager',         label: 'Marketing Manager' },
  { value: 'Account Manager',           label: 'Account Manager' },
  { value: 'Project Manager',           label: 'Project Manager' },
  { value: 'UX/UI Designer',            label: 'UX/UI Designer' },
  { value: 'Photographer',              label: 'Photographer' },
  { value: 'Influencer Manager',        label: 'Influencer Manager' },
  { value: 'PR Specialist',             label: 'PR Specialist' },
  { value: 'Analytics Specialist',      label: 'Analytics Specialist' },
  { value: '__other__',                 label: 'Other…' },
];

// Keep ROLE_OPTIONS for backward compat (edit form uses it for job_title)
const ROLE_OPTIONS = JOB_TITLE_OPTIONS;

// Returns the job title to display on a MemberCard.
// After the team-identity migration, job_title holds the display title.
// For older rows that still store a job title in `role`, fall back to role.
function resolveDisplayJobTitle(member: { role?: string; job_title?: string }): string | null {
  if (member.job_title) return member.job_title;
  // If role looks like a job title (not a known access role), show it
  if (member.role && !(ACCESS_ROLE_VALUES as readonly string[]).includes(member.role)) {
    return member.role;
  }
  return null;
}

function formatWorkspaceRole(role: string | undefined): string {
  const candidate = (role ?? '').toLowerCase();
  const normalized = WORKSPACE_ROLES.includes(candidate as (typeof WORKSPACE_ROLES)[number]) ? candidate : 'member';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

// ── Group label mapping ───────────────────────────────────────────────────────
// Maps a job_title → friendly section name. Falls back to role-based section.
const JOB_TITLE_TO_GROUP: Record<string, string> = {
  'Content Creator':            'Content Creators',
  'Copywriter':                 'Content Creators',
  'Email Marketing Specialist': 'Content Creators',
  'Photographer':               'Content Creators',
  'Graphic Designer':           'Graphic Designers',
  'UX/UI Designer':             'Graphic Designers',
  'Video Editor':               'Video Editors',
  'Social Media Manager':       'Managers',
  'Marketing Manager':          'Managers',
  'Account Manager':            'Managers',
  'Project Manager':            'Managers',
  'Brand Strategist':           'Managers',
  'Influencer Manager':         'Managers',
  'PR Specialist':              'Managers',
  'SEO Specialist':             'Developers',
  'Paid Ads Specialist':        'Developers',
  'Analytics Specialist':       'Developers',
};

const ROLE_TO_GROUP: Record<string, string> = {
  admin:       'Admins',
  manager:     'Managers',
  team_member: 'Team Members',
  viewer:      'Viewers',
  client:      'Clients',
};

// Preferred display order for sections
const SECTION_ORDER = [
  'Admins',
  'Managers',
  'Graphic Designers',
  'Video Editors',
  'Content Creators',
  'Developers',
  'Team Members',
  'Viewers',
  'Clients',
];

function getGroupLabel(member: TeamMember): string {
  const jt = member.job_title?.trim();
  if (jt && JOB_TITLE_TO_GROUP[jt]) return JOB_TITLE_TO_GROUP[jt];
  if (jt) return jt; // keep non-standard job title as its own section label
  return ROLE_TO_GROUP[member.role ?? ''] ?? 'Other Members';
}

function hasInviteInsertResult(data: unknown): data is { member: TeamMember; invitation: TeamInvitation } {
  if (!data || typeof data !== 'object') return false;
  const payload = data as { member?: Partial<TeamMember>; invitation?: Partial<TeamInvitation> };
  return Boolean(
    payload.member?.id
    && payload.member?.full_name
    && payload.member?.email
    && payload.invitation?.id
    && payload.invitation?.team_member_id
    && payload.invitation?.email,
  );
}

/** Group an array of members into ordered sections by role/job title. */
function groupMembers(members: TeamMember[]): { label: string; members: TeamMember[] }[] {
  const map = new Map<string, TeamMember[]>();
  for (const m of members) {
    const label = getGroupLabel(m);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(m);
  }

  // Sort sections: known order first, then alphabetical for the rest
  const sections = Array.from(map.entries()).map(([label, mems]) => ({ label, members: mems }));
  sections.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.label);
    const bi = SECTION_ORDER.indexOf(b.label);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  return sections;
}

// ── RoleField — dropdown + optional custom text input ────────────────────────
function RoleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Determine if the current value matches a preset option
  const isPreset = ROLE_OPTIONS.some(o => o.value === value && o.value !== '__other__');
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
        options={ROLE_OPTIONS}
        placeholder="Select role…"
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
          placeholder="Enter custom role"
          autoFocus
        />
      )}
    </div>
  );
}

const blankForm = {
  full_name: '',
  email: '',
  role: '',
  job_title: '',
  os_access: false,
  docs_access: false,
  os_role: 'member',
  docs_role: 'member',
};
const blankInviteForm = {
  full_name: '',
  email: '',
  access_role: '',
  job_title: '',
  os_access: false,
  docs_access: false,
  os_role: 'member',
  docs_role: 'member',
};

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
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Job Title</label>
        <RoleField value={f.job_title} onChange={v => setF(x => ({ ...x, job_title: v }))} />
      </div>
    </div>
  );
}

// ── InviteForm is also at module scope ───────────────────────────────────────
function InviteForm({
  f,
  setF,
}: {
  f: typeof blankInviteForm;
  setF: React.Dispatch<React.SetStateAction<typeof blankInviteForm>>;
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
          value={f.access_role}
          onChange={v => setF(x => ({ ...x, access_role: v }))}
          options={ACCESS_ROLE_OPTIONS}
          placeholder="Select access level…"
          fullWidth
        />
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Controls what this person can see and do in OPENY OS.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Workspace Access *</p>
        <label className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <span className="text-sm" style={{ color: 'var(--text)' }}>OPENY OS</span>
          <input type="checkbox" checked={f.os_access} onChange={e => setF(x => ({ ...x, os_access: e.target.checked }))} />
        </label>
        {f.os_access && (
          <SelectDropdown
            value={f.os_role}
            onChange={v => setF(x => ({ ...x, os_role: v }))}
            options={WORKSPACE_ROLE_OPTIONS}
            placeholder="OS role"
            fullWidth
          />
        )}
        <label className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <span className="text-sm" style={{ color: 'var(--text)' }}>OPENY DOCS</span>
          <input type="checkbox" checked={f.docs_access} onChange={e => setF(x => ({ ...x, docs_access: e.target.checked }))} />
        </label>
        {f.docs_access && (
          <SelectDropdown
            value={f.docs_role}
            onChange={v => setF(x => ({ ...x, docs_role: v }))}
            options={WORKSPACE_ROLE_OPTIONS}
            placeholder="DOCS role"
            fullWidth
          />
        )}
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Access to each workspace is managed independently.
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Job Title</label>
        <RoleField value={f.job_title} onChange={v => setF(x => ({ ...x, job_title: v }))} />
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Their actual role on the team (e.g. Graphic Designer).
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
    pending:  { label: 'Pending',   color: '#d97706', bg: '#fffbeb' },
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = myRole === 'owner' || myRole === 'admin';

  // ── React Query: fetch and cache team members and invitations ─────────────
  const { data: teamData, isLoading: loading } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const [membersRes, invitesRes, workspaceAccessRes] = await Promise.all([
        // Select only the columns the UI actually uses to reduce payload size.
        supabase.from('team_members').select('id,full_name,email,role,avatar_url,job_title,status,created_at').order('full_name'),
        supabase.from('team_invitations').select('*').order('created_at', { ascending: false }),
        fetch('/api/team/workspace-access', { credentials: 'include' }),
      ]);
      if (membersRes.error) console.error('[team] members fetch error:', membersRes.error.message);
      if (invitesRes.error) console.error('[team] invitations fetch error:', invitesRes.error.message);
      const workspaceAccessJson = workspaceAccessRes.ok
        ? await workspaceAccessRes.json()
        : { access: {} as Record<string, Record<string, { enabled: boolean; role: string }>> };
      return {
        members:     (!membersRes.error  ? (membersRes.data  ?? []) : []) as TeamMember[],
        invitations: (!invitesRes.error  ? (invitesRes.data  ?? []) : []) as TeamInvitation[],
        workspaceAccess: workspaceAccessJson.access as Record<string, Record<string, { enabled: boolean; role: string }>>,
      };
    },
  });

  const members     = teamData?.members     ?? [];
  const invitations = teamData?.invitations ?? [];
  const workspaceAccessByEmail = teamData?.workspaceAccess ?? {};

  const [saving, setSaving]             = useState(false);
  const [actionError, setActionError]   = useState('');

  // Modals
  const [inviteOpen, setInviteOpen]     = useState(false);
  const [editMember, setEditMember]     = useState<TeamMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);

  // Forms — all at the top level, never re-created during render
  const [inviteForm, setInviteForm]     = useState({ ...blankInviteForm });
  const [editForm, setEditForm]         = useState({ ...blankForm });

  // Latest invitation per member (for status display)
  const inviteByMember = useCallback((memberId: string): TeamInvitation | undefined => {
    return invitations.find(i => i.team_member_id === memberId);
  }, [invitations]);

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (!inviteForm.full_name.trim() || !inviteForm.email.trim() || !inviteForm.access_role.trim()) {
      setActionError('Full name, email, and access role are required.');
      return;
    }
    if (!inviteForm.os_access && !inviteForm.docs_access) {
      setActionError('At least one workspace must be enabled (OPENY OS or OPENY DOCS).');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/team/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          full_name:   inviteForm.full_name,
          email:       inviteForm.email,
          access_role: inviteForm.access_role,
          job_title:   inviteForm.job_title,
          workspace_access: [
            ...(inviteForm.os_access ? ['os'] : []),
            ...(inviteForm.docs_access ? ['docs'] : []),
          ],
          workspace_roles: {
            os: inviteForm.os_role,
            docs: inviteForm.docs_role,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const exactDbError = process.env.NODE_ENV === 'development' ? (data.dbError ?? data.error ?? '') : '';
        setActionError(exactDbError || data.error || 'Failed to send invitation.');
        if (data.dbError) console.error('[team] invitation insert error:', data.dbError);
        return;
      }
      if (!hasInviteInsertResult(data)) {
        setActionError('Invite request succeeded but no invitation row was returned.');
        console.error('[team] Missing insert result after invite:', data);
        return;
      }

      queryClient.setQueryData(
        ['team-data'],
        (
          prev:
            | {
                members: TeamMember[];
                invitations: TeamInvitation[];
                workspaceAccess: Record<string, Record<string, { enabled: boolean; role: string }>>;
              }
            | undefined,
        ) => {
          if (!prev) {
            return {
              members: [data.member],
              invitations: [data.invitation],
              workspaceAccess: {},
            };
          }
          const nextMembers = [data.member, ...prev.members.filter(m => m.id !== data.member.id)]
            .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
          const nextInvitations = [data.invitation, ...prev.invitations.filter(i => i.id !== data.invitation.id)]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return {
            ...prev,
            members: nextMembers,
            invitations: nextInvitations,
          };
        },
      );

      setInviteOpen(false);
      setInviteForm({ ...blankInviteForm });
      toast(`Invitation sent to ${inviteForm.email}`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (member: TeamMember) => {
    const access = workspaceAccessByEmail[(member.email ?? '').toLowerCase()] ?? {};
    setEditForm({
      full_name: member.full_name,
      email: member.email ?? '',
      role: member.role ?? '',
      job_title: member.job_title ?? '',
      os_access: access.os?.enabled ?? false,
      docs_access: access.docs?.enabled ?? false,
      os_role: access.os?.role ?? 'member',
      docs_role: access.docs?.role ?? 'member',
    });
    setEditMember(member);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setSaving(true);
    try {
      const memberRes = await fetch(`/api/team/members/${editMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editForm.full_name.trim(),
          email: editForm.email || null,
          role: editForm.role || null,
          job_title: editForm.job_title || null,
        }),
      });
      if (!memberRes.ok) {
        const payload = await memberRes.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Failed to update team member. Please try again.');
      }
      if (editForm.email) {
        const accessRes = await fetch('/api/team/workspace-access', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: editForm.email.trim().toLowerCase(),
            access: {
              os: { enabled: editForm.os_access, role: editForm.os_role },
              docs: { enabled: editForm.docs_access, role: editForm.docs_role },
            },
          }),
        });
        if (!accessRes.ok) {
          const payload = await accessRes.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Failed to update workspace permissions');
        }
      }
      setEditMember(null);
      toast('Member updated successfully', 'success');
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to update member', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteMember) return;
    // Owner is never deletable — guard at both UI and API level.
    if (deleteMember.role === 'owner') {
      toast('The workspace owner cannot be removed.', 'error');
      setDeleteMember(null);
      return;
    }
    try {
      const res = await fetch(`/api/team/members/${deleteMember.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error ?? 'Failed to remove member.', 'error'); return; }
      setDeleteMember(null);
      toast('Member removed', 'info');
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
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
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
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
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
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
  const ownerMembers   = members.filter(m => m.role === 'owner' && (!m.status || m.status === 'active'));
  const activeMembers  = members.filter(m => m.role !== 'owner' && (!m.status || m.status === 'active'));
  const invitedMembers = members.filter(m => m.status === 'invited' || m.status === 'pending');
  const groupedActive  = groupMembers(activeMembers);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('team')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {activeMembers.length + ownerMembers.length} active · {invitedMembers.length} pending
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
          {/* ── 1. Workspace Owner ─────────────────────────────────────────── */}
          {ownerMembers.length > 0 && (
            <section>
              <SectionHeader icon={<Crown size={14} />} label="Workspace Owner" count={ownerMembers.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownerMembers.map(m => (
                  <OwnerCard
                    key={m.id}
                    member={m}
                    canManage={canManage}
                    onEdit={openEdit}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── 2. Active members grouped by role / job title ──────────────── */}
          {groupedActive.map(({ label, members: sectionMembers }) => (
            <section key={label}>
              <SectionHeader icon={<CheckCircle size={14} />} label={label} count={sectionMembers.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sectionMembers.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    workspaceAccess={workspaceAccessByEmail[(m.email ?? '').toLowerCase()]}
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
          ))}
          {invitedMembers.length > 0 && (
            <section>
              <SectionHeader icon={<Clock size={14} />} label="Pending Invitations" count={invitedMembers.length} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {invitedMembers.map(m => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    workspaceAccess={workspaceAccessByEmail[(m.email ?? '').toLowerCase()]}
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
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Workspace Access</p>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text)' }}>OPENY OS</span>
              <input type="checkbox" checked={editForm.os_access} onChange={e => setEditForm(x => ({ ...x, os_access: e.target.checked }))} />
            </label>
            {editForm.os_access && (
              <SelectDropdown
                value={editForm.os_role}
                onChange={v => setEditForm(x => ({ ...x, os_role: v }))}
                options={WORKSPACE_ROLE_OPTIONS}
                placeholder="OS role"
                fullWidth
              />
            )}
            <label className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
              <span className="text-sm" style={{ color: 'var(--text)' }}>OPENY DOCS</span>
              <input type="checkbox" checked={editForm.docs_access} onChange={e => setEditForm(x => ({ ...x, docs_access: e.target.checked }))} />
            </label>
            {editForm.docs_access && (
              <SelectDropdown
                value={editForm.docs_role}
                onChange={v => setEditForm(x => ({ ...x, docs_role: v }))}
                options={WORKSPACE_ROLE_OPTIONS}
                placeholder="DOCS role"
                fullWidth
              />
            )}
          </div>
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

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count }: { icon: ReactNode; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</h2>
      {count !== undefined && (
        <span
          className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── OwnerCard — special elevated card for the workspace owner ─────────────────
function OwnerCard({
  member,
  canManage,
  onEdit,
}: {
  member: TeamMember;
  canManage: boolean;
  onEdit: (m: TeamMember) => void;
}) {
  return (
    <div
      className="rounded-xl border-2 p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{
        background:   'var(--surface)',
        borderColor:  'var(--accent)',
      }}
    >
      {/* subtle accent stripe at top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
        style={{ background: 'var(--accent)' }}
      />
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {member.full_name.charAt(0).toUpperCase()}
          </div>
          <span
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)', color: '#fff' }}
            title="Workspace Owner"
          >
            <Crown size={10} />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{member.full_name}</p>
          <span
            className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Crown size={9} />Owner
          </span>
          {resolveDisplayJobTitle(member) && (
            <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--text-secondary)' }}>
              <Briefcase size={11} />{resolveDisplayJobTitle(member)}
            </p>
          )}
          {member.email && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Mail size={11} />{member.email}
            </p>
          )}
        </div>
        {/* Edit only — owner is never deletable */}
        {canManage && (
          <button
            onClick={() => onEdit(member)}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            title="Edit owner profile"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Member card component (at module scope) ───────────────────────────────────
function MemberCard({
  member,
  workspaceAccess,
  invitation,
  canManage,
  onEdit,
  onDelete,
  onResend,
  onRevoke,
  onCopyLink,
}: {
  member: TeamMember;
  workspaceAccess?: Record<string, { enabled: boolean; role: string }>;
  invitation?: TeamInvitation;
  canManage: boolean;
  onEdit: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
  onResend: (m: TeamMember) => void;
  onRevoke: (m: TeamMember) => void;
  onCopyLink: (m: TeamMember) => void;
}) {
  const isInvited = member.status === 'invited' || member.status === 'pending';

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
            {isInvited && <InviteBadge status={invitation?.status ?? member.status ?? 'pending'} />}
          </div>
          {resolveDisplayJobTitle(member) && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Briefcase size={11} />{resolveDisplayJobTitle(member)}
            </p>
          )}
          {member.role && (ACCESS_ROLE_VALUES as readonly string[]).includes(member.role) && (
            <span
              className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium capitalize"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {member.role}
            </span>
          )}
          {member.email && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Mail size={11} />{member.email}
            </p>
          )}
          <div className="mt-1" aria-label="Workspace access">
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Access:</p>
            <ul className="mt-0.5 flex flex-wrap gap-1.5">
              {workspaceAccess?.os?.enabled && (
                <li className="inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  {getWorkspaceLabel('os')} · {formatWorkspaceRole(workspaceAccess.os.role)}
                </li>
              )}
              {workspaceAccess?.docs?.enabled && (
                <li className="inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  {getWorkspaceLabel('docs')} · {formatWorkspaceRole(workspaceAccess.docs.role)}
                </li>
              )}
              {!workspaceAccess?.os?.enabled && !workspaceAccess?.docs?.enabled && (
                <li className="inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                  No workspace access
                </li>
              )}
            </ul>
          </div>
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

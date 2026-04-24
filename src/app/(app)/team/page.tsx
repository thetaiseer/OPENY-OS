'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Pencil,
  Trash2,
  Mail,
  Briefcase,
  Send,
  RotateCcw,
  XCircle,
  Clock,
  CheckCircle,
  Crown,
  X,
  Shield,
  ChevronDown,
  ChevronUp,
  Activity,
  Copy,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import EmptyState from '@/components/ui/EmptyState';
import AppModal from '@/components/ui/AppModal';
import Modal from '@/components/ui/Modal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type {
  TeamMember,
  TeamInvitation,
  MemberPermissions,
  ModuleAccess,
  OsModule,
  DocsModule,
  ActivityLogEntry,
} from '@/lib/types';
import { getWorkspaceLabel, normalizeWorkspaceKey, WORKSPACE_ROLES } from '@/lib/workspace-access';
import { OS_MODULES, DOCS_MODULES } from '@/lib/permissions';

const inputCls =
  'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = {
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
};

// ── System access roles ───────────────────────────────────────────────────────
// These are the valid values for team_members.role (access control).
// 'owner' is intentionally excluded — ownership cannot be granted via invitation.
const ACCESS_ROLE_VALUES = [
  'owner',
  'admin',
  'manager',
  'team_member',
  'viewer',
  'client',
] as const;

const ACCESS_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin — full access' },
  { value: 'team_member', label: 'Member — standard access' },
];

const WORKSPACE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

const MODULE_ACCESS_OPTIONS: { value: ModuleAccess; label: string }[] = [
  { value: 'full', label: 'Full access' },
  { value: 'read', label: 'Read only' },
  { value: 'none', label: 'No access' },
];

const OS_MODULE_LABELS: Record<OsModule, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients',
  tasks: 'Tasks',
  content: 'Content',
  calendar: 'Calendar',
  assets: 'Assets',
  reports: 'Reports',
  team: 'Team',
  activity: 'Activity',
  security: 'Security',
};

const DOCS_MODULE_LABELS: Record<DocsModule, string> = {
  invoice: 'Invoice',
  quotation: 'Quotation',
  contracts: 'Contracts',
  accounting: 'Accounting',
};

const ACTIVE_INVITE_STATUSES = new Set(['pending', 'invited']);
const CANCELLATION_STATUSES = new Set(['revoked', 'cancelled']);

// ── Marketing roles list (job titles) ────────────────────────────────────────
// Stored in team_members.job_title — separate from the access role.
const JOB_TITLE_OPTIONS = [
  { value: 'Content Creator', label: 'Content Creator' },
  { value: 'Social Media Manager', label: 'Social Media Manager' },
  { value: 'Graphic Designer', label: 'Graphic Designer' },
  { value: 'Video Editor', label: 'Video Editor' },
  { value: 'Copywriter', label: 'Copywriter' },
  { value: 'SEO Specialist', label: 'SEO Specialist' },
  { value: 'Paid Ads Specialist', label: 'Paid Ads Specialist' },
  { value: 'Email Marketing Specialist', label: 'Email Marketing Specialist' },
  { value: 'Brand Strategist', label: 'Brand Strategist' },
  { value: 'Marketing Manager', label: 'Marketing Manager' },
  { value: 'Account Manager', label: 'Account Manager' },
  { value: 'Project Manager', label: 'Project Manager' },
  { value: 'UX/UI Designer', label: 'UX/UI Designer' },
  { value: 'Photographer', label: 'Photographer' },
  { value: 'Influencer Manager', label: 'Influencer Manager' },
  { value: 'PR Specialist', label: 'PR Specialist' },
  { value: 'Analytics Specialist', label: 'Analytics Specialist' },
  { value: '__other__', label: 'Other…' },
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
  const normalized = WORKSPACE_ROLES.includes(candidate as (typeof WORKSPACE_ROLES)[number])
    ? candidate
    : 'member';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatAccessRole(role: string | null | undefined): string {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'team_member') return 'Member';
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'admin') return 'Admin';
  if (!normalized) return 'Member';
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseInviteWorkspaceAccess(raw: TeamInvitation['workspace_access']): Array<'os' | 'docs'> {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(raw) as unknown;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];
  return [
    ...new Set(
      values
        .map((value) => normalizeWorkspaceKey(value))
        .filter((value): value is 'os' | 'docs' => value === 'os' || value === 'docs'),
    ),
  ];
}

function parseInviteWorkspaceRoles(raw: TeamInvitation['workspace_roles']): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, string>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

function formatWorkspaceAccessSummary(access: Array<'os' | 'docs'>): string {
  if (access.length === 2) return 'OPENY OS + OPENY DOCS';
  if (access[0] === 'docs') return 'OPENY DOCS';
  return 'OPENY OS';
}

function hasInviteInsertResult(
  data: unknown,
): data is { member: TeamMember; invitation: TeamInvitation } {
  if (!data || typeof data !== 'object') return false;
  const payload = data as { member?: Partial<TeamMember>; invitation?: Partial<TeamInvitation> };
  return Boolean(
    payload.member?.id &&
    payload.member?.full_name &&
    payload.member?.email &&
    payload.invitation?.id &&
    payload.invitation?.team_member_id &&
    payload.invitation?.email,
  );
}

// ── RoleField — dropdown + optional custom text input ────────────────────────
function RoleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Determine if the current value matches a preset option
  const isPreset = ROLE_OPTIONS.some((o) => o.value === value && o.value !== '__other__');
  const [dropVal, setDropVal] = useState(isPreset ? value : value ? '__other__' : '');
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
          onChange={(e) => handleCustomChange(e.target.value)}
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

type ModulePermMap = Record<string, ModuleAccess>;

const blankInviteForm = {
  full_name: '',
  email: '',
  access_role: '',
  job_title: '',
  os_access: false,
  docs_access: false,
  os_role: 'member',
  docs_role: 'member',
  show_advanced_permissions: false,
  os_permissions: {} as ModulePermMap,
  docs_permissions: {} as ModulePermMap,
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
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Full Name *
        </label>
        <input
          required
          value={f.full_name}
          onChange={(e) => setF((x) => ({ ...x, full_name: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Team member name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Email
        </label>
        <input
          type="email"
          value={f.email}
          onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="email@company.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Job Title
        </label>
        <RoleField value={f.job_title} onChange={(v) => setF((x) => ({ ...x, job_title: v }))} />
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
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Full Name *
        </label>
        <input
          required
          value={f.full_name}
          onChange={(e) => setF((x) => ({ ...x, full_name: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Team member name"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Email *
        </label>
        <input
          required
          type="email"
          value={f.email}
          onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="email@company.com"
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Access Role *
        </label>
        <SelectDropdown
          value={f.access_role}
          onChange={(v) => setF((x) => ({ ...x, access_role: v }))}
          options={ACCESS_ROLE_OPTIONS}
          placeholder="Select access level…"
          fullWidth
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Controls what this person can see and do in OPENY OS.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Workspace Access *
        </p>
        <label
          className="flex items-center justify-between rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            OPENY OS
          </span>
          <input
            type="checkbox"
            checked={f.os_access}
            onChange={(e) => setF((x) => ({ ...x, os_access: e.target.checked }))}
          />
        </label>
        {f.os_access && (
          <SelectDropdown
            value={f.os_role}
            onChange={(v) => setF((x) => ({ ...x, os_role: v }))}
            options={WORKSPACE_ROLE_OPTIONS}
            placeholder="OS role"
            fullWidth
          />
        )}
        <label
          className="flex items-center justify-between rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            OPENY DOCS
          </span>
          <input
            type="checkbox"
            checked={f.docs_access}
            onChange={(e) => setF((x) => ({ ...x, docs_access: e.target.checked }))}
          />
        </label>
        {f.docs_access && (
          <SelectDropdown
            value={f.docs_role}
            onChange={(v) => setF((x) => ({ ...x, docs_role: v }))}
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
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          Job Title
        </label>
        <RoleField value={f.job_title} onChange={(v) => setF((x) => ({ ...x, job_title: v }))} />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Their actual role on the team (e.g. Graphic Designer).
        </p>
      </div>

      {/* ── Advanced module permissions (optional) ──────────────────────── */}
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() =>
            setF((x) => ({ ...x, show_advanced_permissions: !x.show_advanced_permissions }))
          }
          className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <span className="flex items-center gap-2">
            <Shield size={14} style={{ color: 'var(--accent)' }} />
            Advanced Module Permissions
          </span>
          {f.show_advanced_permissions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {f.show_advanced_permissions && (
          <div className="space-y-3 px-3 py-3" style={{ background: 'var(--surface)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Override default access for specific modules. Leave blank to use role defaults.
            </p>
            {f.os_access && (
              <div>
                <p
                  className="mb-2 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  OPENY OS Modules
                </p>
                <div className="space-y-1.5">
                  {OS_MODULES.map((mod) => (
                    <div key={mod} className="flex items-center justify-between gap-2">
                      <span className="text-xs capitalize" style={{ color: 'var(--text)' }}>
                        {OS_MODULE_LABELS[mod]}
                      </span>
                      <SelectDropdown
                        value={f.os_permissions[mod] ?? ''}
                        onChange={(v) =>
                          setF((x) => {
                            const perms = { ...x.os_permissions };
                            if (v) perms[mod] = v as ModuleAccess;
                            else delete perms[mod];
                            return { ...x, os_permissions: perms };
                          })
                        }
                        options={[{ value: '', label: 'Default' }, ...MODULE_ACCESS_OPTIONS]}
                        placeholder="Default"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {f.docs_access && (
              <div>
                <p
                  className="mb-2 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  OPENY DOCS Modules
                </p>
                <div className="space-y-1.5">
                  {DOCS_MODULES.map((mod) => (
                    <div key={mod} className="flex items-center justify-between gap-2">
                      <span className="text-xs capitalize" style={{ color: 'var(--text)' }}>
                        {DOCS_MODULE_LABELS[mod]}
                      </span>
                      <SelectDropdown
                        value={f.docs_permissions[mod] ?? ''}
                        onChange={(v) =>
                          setF((x) => {
                            const perms = { ...x.docs_permissions };
                            if (v) perms[mod] = v as ModuleAccess;
                            else delete perms[mod];
                            return { ...x, docs_permissions: perms };
                          })
                        }
                        options={[{ value: '', label: 'Default' }, ...MODULE_ACCESS_OPTIONS]}
                        placeholder="Default"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
    pending: { label: 'Pending', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    invited: { label: 'Invited', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
    accepted: { label: 'Active', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    expired: { label: 'Expired', color: 'var(--text-secondary)', bg: 'var(--surface-2)' },
    revoked: { label: 'Cancelled', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
    cancelled: { label: 'Cancelled', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
  };
  const c = cfg[status] ?? {
    label: status,
    color: 'var(--text-secondary)',
    bg: 'var(--surface-2)',
  };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

// ── AccessBadge — colored module access level badge ───────────────────────────
function AccessBadge({ level }: { level: ModuleAccess }) {
  const cfg: Record<ModuleAccess, { color: string; bg: string; label: string }> = {
    full: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: 'Full' },
    read: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', label: 'Read' },
    none: { color: 'var(--text-secondary)', bg: 'var(--surface-2)', label: 'None' },
  };
  const c = cfg[level];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ color: c.color, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

// ── MemberSidePanel ───────────────────────────────────────────────────────────
function MemberSidePanel({
  member,
  workspaceAccess,
  canManage,
  refreshKey,
  onClose,
  onEdit,
  onDelete,
}: {
  member: TeamMember;
  workspaceAccess?: Record<string, { enabled: boolean; role: string }>;
  canManage: boolean;
  refreshKey?: number;
  onClose: () => void;
  onEdit: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
}) {
  const [permissions, setPermissions] = useState<MemberPermissions | null>(null);
  const [permLoading, setPermLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const [actLoading, setActLoading] = useState(true);

  const isOwner = member.role === 'owner';

  useEffect(() => {
    async function load() {
      setPermLoading(true);
      try {
        const res = await fetch(`/api/team/members/${member.id}/permissions`);
        if (res.ok) {
          const data = (await res.json()) as { permissions?: MemberPermissions };
          setPermissions(data.permissions ?? null);
        }
      } catch {
        /* ignore */
      } finally {
        setPermLoading(false);
      }
    }
    void load();
  }, [member.id, refreshKey]);

  useEffect(() => {
    async function load() {
      setActLoading(true);
      try {
        // Fetch activities filtered by the member's profile_id (actor) or their team_member id (entity)
        const params = new URLSearchParams({ limit: '20', category: 'team' });
        if (member.profile_id) {
          params.set('actor_id', member.profile_id);
        }
        const res = await fetch(`/api/activity-timeline?${params.toString()}`);
        if (res.ok) {
          const data = (await res.json()) as { activities?: ActivityLogEntry[] };
          const all = data.activities ?? [];
          // Client-filter to ensure only this member's events appear
          const relevant = all.filter(
            (a) => a.entity_id === member.id || a.actor_id === member.profile_id,
          );
          setRecentActivity(relevant.slice(0, 5));
        }
      } catch {
        /* ignore */
      } finally {
        setActLoading(false);
      }
    }
    void load();
  }, [member.id, member.profile_id]);

  function formatDate(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <AppModal
      open
      onClose={onClose}
      hideHeader
      size="sm"
      panelClassName="max-w-[420px]"
      bodyClassName="p-0"
    >
      <div className="flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Member Profile
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Identity */}
        <div className="border-b px-5 py-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: isOwner ? 'var(--accent)' : '#6366f1' }}
            >
              {member.full_name.charAt(0).toUpperCase()}
              {isOwner && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Crown size={10} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold" style={{ color: 'var(--text)' }}>
                {member.full_name}
              </p>
              {member.email && (
                <p
                  className="mt-0.5 flex items-center gap-1 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Mail size={11} />
                  {member.email}
                </p>
              )}
              {resolveDisplayJobTitle(member) && (
                <p
                  className="mt-0.5 flex items-center gap-1 text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Briefcase size={11} />
                  {resolveDisplayJobTitle(member)}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {isOwner && <Crown size={9} />}
                  {formatAccessRole(member.role)}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}
                >
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Access */}
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            Workspace Access
          </p>
          <div className="flex flex-wrap gap-2">
            {workspaceAccess?.os?.enabled && (
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {getWorkspaceLabel('os')} · {workspaceAccess.os.role}
              </span>
            )}
            {workspaceAccess?.docs?.enabled && (
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {getWorkspaceLabel('docs')} · {workspaceAccess.docs.role}
              </span>
            )}
            {!workspaceAccess?.os?.enabled && !workspaceAccess?.docs?.enabled && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                No workspace access configured
              </span>
            )}
          </div>
        </div>

        {/* Module Permissions */}
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Shield size={12} className="mr-1 inline" />
            Module Permissions
          </p>
          {permLoading ? (
            <div className="space-y-1.5">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-5 animate-pulse rounded"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))}
            </div>
          ) : permissions ? (
            <div className="space-y-3">
              {workspaceAccess?.os?.enabled && (
                <div>
                  <p
                    className="mb-1.5 text-[11px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    OS
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {OS_MODULES.map((mod) => (
                      <div key={mod} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: 'var(--text)' }}>
                          {OS_MODULE_LABELS[mod]}
                        </span>
                        <AccessBadge level={permissions.os[mod]} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {workspaceAccess?.docs?.enabled && (
                <div>
                  <p
                    className="mb-1.5 text-[11px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    DOCS
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {DOCS_MODULES.map((mod) => (
                      <div key={mod} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: 'var(--text)' }}>
                          {DOCS_MODULE_LABELS[mod]}
                        </span>
                        <AccessBadge level={permissions.docs[mod]} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Permissions unavailable
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Activity size={12} className="mr-1 inline" />
            Recent Activity
          </p>
          {actLoading ? (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-5 animate-pulse rounded"
                  style={{ background: 'var(--surface-2)' }}
                />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              No recent activity found.
            </p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2">
                  <div
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs" style={{ color: 'var(--text)' }}>
                      {entry.title ?? entry.description}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {canManage && !isOwner && (
          <div className="mt-auto space-y-2 px-5 py-4">
            <button
              onClick={() => {
                onClose();
                onEdit(member);
              }}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              <Pencil size={14} />
              Edit Profile & Role
            </button>
            <button
              onClick={() => {
                onClose();
                onDelete(member);
              }}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
              style={{
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger-border)',
                background: 'var(--color-danger-bg)',
              }}
            >
              <Trash2 size={14} />
              Remove Member
            </button>
          </div>
        )}
      </div>
    </AppModal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { t } = useLang();
  const { role: myRole, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = myRole === 'owner' || myRole === 'admin';
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  // ── React Query: fetch and cache team members and invitations ─────────────
  const { data: teamData, isLoading: loading } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const [membersRes, invitesRes, workspaceAccessRes] = await Promise.all([
        fetch('/api/team/members', { credentials: 'include' }),
        fetch('/api/team/invitations', { credentials: 'include' }),
        fetch('/api/team/workspace-access', { credentials: 'include' }),
      ]);
      if (!membersRes.ok) {
        const message = await membersRes.text().catch(() => 'failed to fetch team members');
        console.error('[team] members fetch error:', message);
      }
      if (!invitesRes.ok) {
        const message = await invitesRes.text().catch(() => 'failed to fetch invitations');
        console.error('[team] invitations fetch error:', message);
      }
      const membersJson = membersRes.ok ? await membersRes.json() : { members: [] as TeamMember[] };
      const invitesJson = invitesRes.ok
        ? await invitesRes.json()
        : { invitations: [] as TeamInvitation[] };
      const workspaceAccessJson = workspaceAccessRes.ok
        ? await workspaceAccessRes.json()
        : { access: {} as Record<string, Record<string, { enabled: boolean; role: string }>> };
      const invitationRows = (invitesJson.invitations ?? []) as TeamInvitation[];

      const mergedInvitations = new Map<string, TeamInvitation>();
      for (const invitation of invitationRows) {
        const key = invitation.team_member_id || (invitation.email ?? '').toLowerCase();
        if (!key) continue;
        mergedInvitations.set(key, invitation);
      }
      return {
        members: (membersJson.members ?? []) as TeamMember[],
        invitations: [...mergedInvitations.values()],
        workspaceAccess: workspaceAccessJson.access as Record<
          string,
          Record<string, { enabled: boolean; role: string }>
        >,
      };
    },
  });

  const members = useMemo(() => teamData?.members ?? [], [teamData?.members]);
  const invitations = useMemo(() => teamData?.invitations ?? [], [teamData?.invitations]);
  const workspaceAccessByEmail = teamData?.workspaceAccess ?? {};

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  // Modals
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);

  // Member profile side panel
  const [panelMember, setPanelMember] = useState<TeamMember | null>(null);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  // Forms — all at the top level, never re-created during render
  const [inviteForm, setInviteForm] = useState({ ...blankInviteForm });
  const [editForm, setEditForm] = useState({ ...blankForm });

  useEffect(() => {
    const channel = supabase
      .channel('team-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['team-data'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['team-data'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_invitations' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['team-data'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_permissions' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['team-data'] });
        // Increment refresh key to force MemberSidePanel to re-fetch permissions
        setPanelRefreshKey((k) => k + 1);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const invitationByMember = useMemo(() => {
    const map = new Map<string, TeamInvitation>();
    for (const invitation of invitations) {
      if (!invitation.team_member_id || map.has(invitation.team_member_id)) continue;
      map.set(invitation.team_member_id, invitation);
    }
    return map;
  }, [invitations]);

  const uniqueInvitations = useMemo(() => {
    const seen = new Set<string>();
    const rows: TeamInvitation[] = [];
    for (const invitation of invitations) {
      const key = invitation.team_member_id || (invitation.email ?? '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(invitation);
    }
    return rows;
  }, [invitations]);

  const pendingInvites = useMemo(
    () =>
      uniqueInvitations.filter((invite) =>
        ACTIVE_INVITE_STATUSES.has((invite.status ?? '').toLowerCase()),
      ),
    [uniqueInvitations],
  );

  const invitationHistory = useMemo(
    () =>
      uniqueInvitations.filter(
        (invite) => !ACTIVE_INVITE_STATUSES.has((invite.status ?? '').toLowerCase()),
      ),
    [uniqueInvitations],
  );

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    if (
      !inviteForm.full_name.trim() ||
      !inviteForm.email.trim() ||
      !inviteForm.access_role.trim()
    ) {
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: inviteForm.full_name,
          email: inviteForm.email,
          access_role: inviteForm.access_role,
          job_title: inviteForm.job_title,
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
        const exactDbError =
          process.env.NODE_ENV === 'development' ? (data.dbError ?? data.error ?? '') : '';
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
          const optimisticInvitation: TeamInvitation = {
            ...data.invitation,
            team_member: {
              full_name: inviteForm.full_name,
              job_title: inviteForm.job_title || null,
              role: inviteForm.access_role,
              status: 'invited',
            },
          };
          if (!prev) {
            return {
              members: [data.member],
              invitations: [optimisticInvitation],
              workspaceAccess: {},
            };
          }
          const nextMembers = [
            data.member,
            ...prev.members.filter((m) => m.id !== data.member.id),
          ].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
          const nextInvitations = [
            optimisticInvitation,
            ...prev.invitations.filter((i) => i.id !== data.invitation.id),
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
      if (!res.ok) {
        toast(data.error ?? 'Failed to remove member.', 'error');
        return;
      }
      setDeleteMember(null);
      toast('Member removed', 'info');
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch {
      toast('Network error. Please try again.', 'error');
    }
  };

  // ── Resend invite ─────────────────────────────────────────────────────────
  const handleResend = async (invitation: TeamInvitation) => {
    try {
      const res = await fetch('/api/team/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: invitation.team_member_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Failed to resend invitation.', 'error');
        return;
      }
      toast(`Invitation resent to ${invitation.email}`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch {
      toast('Network error. Please try again.', 'error');
    }
  };

  // ── Cancel invite ─────────────────────────────────────────────────────────
  const handleCancelInvite = async (invitation: TeamInvitation) => {
    if (!confirm(`Cancel invitation for ${invitation.email}?`)) return;
    try {
      const res = await fetch('/api/team/invite/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: invitation.team_member_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? 'Failed to revoke invitation.', 'error');
        return;
      }
      toast('Invitation cancelled', 'info');
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch {
      toast('Network error. Please try again.', 'error');
    }
  };

  const handleCopyInviteLink = async (invitation: TeamInvitation) => {
    if (!invitation.token) {
      toast('Invite link is unavailable for this invitation.', 'error');
      return;
    }

    const inviteUrl = `${window.location.origin}/invite?token=${encodeURIComponent(invitation.token)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast('Invite link copied', 'success');
    } catch {
      toast('Failed to copy invite link', 'error');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const ownerMembers = members.filter(
    (m) => m.role === 'owner' && (!m.status || m.status === 'active'),
  );
  const ownerMembersForDisplay =
    ownerMembers.length > 0
      ? ownerMembers
      : myRole === 'owner' && user.id && user.email
        ? [
            {
              id: user.id,
              full_name: user.name || tr('workspaceOwner', 'Workspace Owner'),
              email: user.email,
              role: 'owner',
              status: 'active',
              created_at: new Date().toISOString(),
            } satisfies TeamMember,
          ]
        : [];
  const activeMembers = members
    .filter((m) => m.role !== 'owner' && (!m.status || m.status === 'active'))
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));

  const hasAnyTeamData =
    ownerMembersForDisplay.length > 0 || activeMembers.length > 0 || pendingInvites.length > 0;

  return (
    <div className="app-page-shell mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">{t('team')}</h1>
          <p className="app-page-subtitle">
            {activeMembers.length + ownerMembersForDisplay.length} active · {pendingInvites.length}{' '}
            pending
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setActionError('');
              setInviteOpen(true);
            }}
            className="flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Send size={15} />
            Invite Member
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      ) : !hasAnyTeamData ? (
        <EmptyState
          icon={Users}
          title={tr('noTeamMembers', 'No team members yet')}
          description={tr(
            'noTeamMembersDesc',
            'Invite teammates to collaborate across OPENY OS and OPENY DOCS with secure, role-based access.',
          )}
          action={
            canManage ? (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Send size={15} />
                Invite Member
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section
            className="rounded-2xl border p-5 shadow-card"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <SectionHeader
              icon={<Crown size={14} />}
              label="Owner"
              count={ownerMembersForDisplay.length}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ownerMembersForDisplay.map((m) => (
                <OwnerCard key={m.id} member={m} canManage={canManage} onEdit={openEdit} />
              ))}
            </div>
          </section>

          <section
            className="rounded-2xl border p-5 shadow-card"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <SectionHeader
              icon={<CheckCircle size={14} />}
              label="Active Team Members"
              count={activeMembers.length}
            />
            {activeMembers.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {tr('noActiveMembers', 'No active members yet.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeMembers.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    workspaceAccess={workspaceAccessByEmail[(m.email ?? '').toLowerCase()]}
                    invitation={invitationByMember.get(m.id)}
                    canManage={canManage}
                    onEdit={openEdit}
                    onDelete={setDeleteMember}
                    onView={setPanelMember}
                  />
                ))}
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border p-5 shadow-card"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <SectionHeader
              icon={<Clock size={14} />}
              label="Pending Invitations"
              count={pendingInvites.length}
            />
            {pendingInvites.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {tr('noPendingInvitations', 'No pending invitations.')}
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invitation) => (
                  <PendingInvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    canManage={canManage}
                    onResend={handleResend}
                    onCopyLink={handleCopyInviteLink}
                    onCancel={handleCancelInvite}
                  />
                ))}
              </div>
            )}
            {invitationHistory.length > 0 && (
              <div
                className="mt-5 space-y-2 border-t pt-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Invite History
                </p>
                <div className="space-y-2">
                  {invitationHistory.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm" style={{ color: 'var(--text)' }}>
                          {invitation.email}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {invitation.role ? `${formatAccessRole(invitation.role)} · ` : ''}Created{' '}
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <InviteBadge
                        status={
                          CANCELLATION_STATUSES.has((invitation.status ?? '').toLowerCase())
                            ? 'cancelled'
                            : invitation.status
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Team Member"
        size="sm"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <InviteForm f={inviteForm} setF={setInviteForm} />
          {actionError && (
            <p
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
            >
              {actionError}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="h-9 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              <Send size={14} />
              {saving ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)} title="Edit Member" size="sm">
        <form onSubmit={handleEdit} className="space-y-4">
          <MemberForm f={editForm} setF={setEditForm} />
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Workspace Access
            </p>
            <label
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                OPENY OS
              </span>
              <input
                type="checkbox"
                checked={editForm.os_access}
                onChange={(e) => setEditForm((x) => ({ ...x, os_access: e.target.checked }))}
              />
            </label>
            {editForm.os_access && (
              <SelectDropdown
                value={editForm.os_role}
                onChange={(v) => setEditForm((x) => ({ ...x, os_role: v }))}
                options={WORKSPACE_ROLE_OPTIONS}
                placeholder="OS role"
                fullWidth
              />
            )}
            <label
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                OPENY DOCS
              </span>
              <input
                type="checkbox"
                checked={editForm.docs_access}
                onChange={(e) => setEditForm((x) => ({ ...x, docs_access: e.target.checked }))}
              />
            </label>
            {editForm.docs_access && (
              <SelectDropdown
                value={editForm.docs_role}
                onChange={(v) => setEditForm((x) => ({ ...x, docs_role: v }))}
                options={WORKSPACE_ROLE_OPTIONS}
                placeholder="DOCS role"
                fullWidth
              />
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditMember(null)}
              className="h-9 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-9 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Modal
        open={!!deleteMember}
        onClose={() => setDeleteMember(null)}
        title="Remove Member"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Remove <strong>{deleteMember?.full_name}</strong> from the team? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteMember(null)}
              className="h-9 rounded-lg px-4 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-9 rounded-xl px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-danger)' }}
            >
              Remove
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Member Profile Side Panel ─────────────────────────────────────── */}
      {panelMember && (
        <MemberSidePanel
          member={panelMember}
          workspaceAccess={workspaceAccessByEmail[(panelMember.email ?? '').toLowerCase()]}
          canManage={canManage}
          refreshKey={panelRefreshKey}
          onClose={() => setPanelMember(null)}
          onEdit={(m) => {
            setPanelMember(null);
            openEdit(m);
          }}
          onDelete={(m) => {
            setPanelMember(null);
            setDeleteMember(m);
          }}
        />
      )}
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count }: { icon: ReactNode; label: string; count?: number }) {
  return (
    <div
      className="mb-4 flex items-center gap-2 border-b pb-2"
      style={{ borderColor: 'var(--border)' }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </h2>
      {count !== undefined && (
        <span
          className="ml-1 rounded-full px-1.5 py-0.5 text-xs font-medium"
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
      className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 p-5 shadow-card"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--accent)',
      }}
    >
      {/* subtle accent stripe at top */}
      <div
        className="absolute left-0 right-0 top-0 h-0.5 rounded-t-xl"
        style={{ background: 'var(--accent)' }}
      />
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {member.full_name.charAt(0).toUpperCase()}
          </div>
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
            title="Workspace Owner"
          >
            <Crown size={10} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            {member.full_name}
          </p>
          <span
            className="mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Crown size={9} />
            Owner
          </span>
          {resolveDisplayJobTitle(member) && (
            <p
              className="mt-1 flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Briefcase size={11} />
              {resolveDisplayJobTitle(member)}
            </p>
          )}
          {member.email && (
            <p
              className="mt-0.5 flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Mail size={11} />
              {member.email}
            </p>
          )}
        </div>
        {/* Edit only — owner is never deletable */}
        {canManage && (
          <button
            onClick={() => onEdit(member)}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
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

function PendingInvitationRow({
  invitation,
  canManage,
  onResend,
  onCopyLink,
  onCancel,
}: {
  invitation: TeamInvitation;
  canManage: boolean;
  onResend: (invitation: TeamInvitation) => void;
  onCopyLink: (invitation: TeamInvitation) => void;
  onCancel: (invitation: TeamInvitation) => void;
}) {
  const member = Array.isArray(invitation.team_member)
    ? invitation.team_member[0]
    : invitation.team_member;
  const profile =
    member && typeof member === 'object' && 'profiles' in member
      ? Array.isArray((member as { profiles?: unknown }).profiles)
        ? (member as { profiles?: Array<{ full_name?: string | null; email?: string | null }> })
            .profiles?.[0]
        : (member as { profiles?: { full_name?: string | null; email?: string | null } }).profiles
      : null;
  const displayEmail = invitation.email ?? profile?.email ?? '';
  const displayName = member?.full_name ?? profile?.full_name ?? displayEmail;
  const roleLabel = formatAccessRole(invitation.role ?? member?.role ?? 'team_member');
  const status = CANCELLATION_STATUSES.has((invitation.status ?? '').toLowerCase())
    ? 'cancelled'
    : invitation.status;
  const canCancel = ACTIVE_INVITE_STATUSES.has((invitation.status ?? '').toLowerCase());
  const canResend = canCancel || invitation.status === 'expired';
  const workspaceAccess = parseInviteWorkspaceAccess(invitation.workspace_access);
  const workspaceRoles = parseInviteWorkspaceRoles(invitation.workspace_roles);
  const workspaceSummary = formatWorkspaceAccessSummary(workspaceAccess);

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {displayName || displayEmail}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
            {displayEmail}
          </p>
          <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
            {roleLabel} · Invited {new Date(invitation.created_at).toLocaleDateString()}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {workspaceAccess.map((workspace) => (
              <span
                key={`${invitation.id}-${workspace}`}
                className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
              >
                {getWorkspaceLabel(workspace)} · {formatWorkspaceRole(workspaceRoles[workspace])}
              </span>
            ))}
            {workspaceAccess.length === 0 && (
              <span
                className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
              >
                OPENY OS · Member
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Workspace Access: {workspaceSummary}
          </p>
          {invitation.expires_at && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Expires {new Date(invitation.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <InviteBadge status={status} />
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {canResend && (
            <button
              onClick={() => onResend(invitation)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-[var(--surface)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <RotateCcw size={12} />
              Resend
            </button>
          )}
          <button
            onClick={() => onCopyLink(invitation)}
            disabled={!invitation.token}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Copy size={12} />
            Copy Invite Link
          </button>
          {canCancel && (
            <button
              onClick={() => onCancel(invitation)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:opacity-90"
              style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
            >
              <XCircle size={12} />
              Cancel Invitation
            </button>
          )}
        </div>
      )}
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
  onView,
}: {
  member: TeamMember;
  workspaceAccess?: Record<string, { enabled: boolean; role: string }>;
  invitation?: TeamInvitation;
  canManage: boolean;
  onEdit: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
  onView?: (m: TeamMember) => void;
}) {
  const isInvited = member.status === 'invited' || member.status === 'pending';
  const isInteractive = !isInvited && !!onView;

  return (
    <div
      className={
        'flex flex-col gap-3 rounded-2xl border p-5 shadow-card transition-shadow' +
        (isInteractive ? ' cursor-pointer hover:-translate-y-0.5' : '')
      }
      onClick={() => isInteractive && onView?.(member)}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : -1}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onView?.(member);
        }
      }}
      style={{
        background: 'var(--surface)',
        borderColor: isInvited ? 'var(--accent)' : 'var(--border)',
        opacity: isInvited ? 0.92 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: isInvited ? '#d97706' : 'var(--accent)' }}
        >
          {member.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {member.full_name}
            </p>
            {isInvited ? (
              <InviteBadge status={invitation?.status ?? member.status ?? 'pending'} />
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}
              >
                Active
              </span>
            )}
          </div>
          {resolveDisplayJobTitle(member) && (
            <p
              className="mt-0.5 flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Briefcase size={11} />
              {resolveDisplayJobTitle(member)}
            </p>
          )}
          {member.role && (ACCESS_ROLE_VALUES as readonly string[]).includes(member.role) && (
            <span
              className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-xs font-medium capitalize"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {formatAccessRole(member.role)}
            </span>
          )}
          {member.email && (
            <p
              className="mt-0.5 flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Mail size={11} />
              {member.email}
            </p>
          )}
          <div className="mt-1">
            <p
              id={`member-access-${member.id}`}
              className="text-[11px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Access:
            </p>
            <ul
              aria-labelledby={`member-access-${member.id}`}
              className="mt-0.5 flex flex-wrap gap-1.5"
            >
              {workspaceAccess?.os?.enabled && (
                <li
                  className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  {getWorkspaceLabel('os')} · {formatWorkspaceRole(workspaceAccess.os.role)}
                </li>
              )}
              {workspaceAccess?.docs?.enabled && (
                <li
                  className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  {getWorkspaceLabel('docs')} · {formatWorkspaceRole(workspaceAccess.docs.role)}
                </li>
              )}
              {!workspaceAccess?.os?.enabled && !workspaceAccess?.docs?.enabled && (
                <li
                  className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  No workspace access
                </li>
              )}
            </ul>
          </div>
          {invitation && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Invited {new Date(invitation.created_at).toLocaleDateString()}
              {invitation.expires_at &&
                ` · expires ${new Date(invitation.expires_at).toLocaleDateString()}`}
            </p>
          )}
        </div>
        {canManage && !isInvited && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onEdit(member)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={() => onDelete(member)}
              className="rounded-lg p-1.5 transition-colors hover:bg-[var(--color-danger-bg)]"
              style={{ color: 'var(--color-danger)' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Invite actions row */}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import SelectDropdown from '@/components/ui/SelectDropdown';
import EntityActionsMenu from '@/components/ui/actions/EntityActionsMenu';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import type {
  TeamMember,
  TeamInvitation,
  MemberPermissions,
  ModuleAccess,
  OsModule,
  DocsModule,
  ActivityLogEntry,
} from '@/lib/types';
import { normalizeWorkspaceKey, WORKSPACE_ROLES } from '@/lib/workspace-access';
import { OS_MODULES, DOCS_MODULES } from '@/lib/permissions';
import { looksLikeUuid } from '@/lib/member-display-name';
import { useRemoveTeamMember } from '@/hooks/mutations/useRemoveTeamMember';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

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

function getAccessRoleOptions(t: TranslateFn) {
  return [
    { value: 'admin', label: t('teamAccessInviteAdmin') },
    { value: 'manager', label: t('teamAccessInviteManager') },
    { value: 'team_member', label: t('teamAccessInviteMember') },
    { value: 'viewer', label: t('teamAccessInviteViewer') },
  ];
}

function getWorkspaceRoleOptions(t: TranslateFn) {
  return [
    { value: 'admin', label: t('teamWsRoleAdmin') },
    { value: 'member', label: t('teamWsRoleMember') },
    { value: 'viewer', label: t('teamWsRoleViewer') },
  ];
}

function getModuleAccessOptions(t: TranslateFn): { value: ModuleAccess; label: string }[] {
  return [
    { value: 'full', label: t('teamModuleAccessFull') },
    { value: 'read', label: t('teamModuleAccessRead') },
    { value: 'none', label: t('teamModuleAccessNone') },
  ];
}

const OS_MODULE_LANG_KEYS: Record<OsModule, string> = {
  dashboard: 'dashboard',
  clients: 'clients',
  tasks: 'tasks',
  content: 'content',
  calendar: 'calendar',
  assets: 'assets',
  reports: 'reports',
  team: 'team',
  activity: 'activity',
  security: 'security',
};

const DOCS_MODULE_LANG_KEYS: Record<DocsModule, string> = {
  invoice: 'docModuleInvoice',
  quotation: 'docModuleQuotation',
  contracts: 'docsModuleContracts',
  accounting: 'docModuleAccounting',
};

function workspaceLabelUi(workspace: 'os' | 'docs', t: TranslateFn) {
  return workspace === 'os' ? t('workspaceBrandOs') : t('workspaceBrandDocs');
}

function osModuleLabel(mod: OsModule, t: TranslateFn) {
  return t(OS_MODULE_LANG_KEYS[mod]);
}

function docsModuleLabel(mod: DocsModule, t: TranslateFn) {
  return t(DOCS_MODULE_LANG_KEYS[mod]);
}

const ACTIVE_INVITE_STATUSES = new Set(['pending', 'invited']);
const CANCELLATION_STATUSES = new Set(['revoked', 'cancelled']);
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Marketing roles list (job titles) ────────────────────────────────────────
// Stored in team_members.job_title — separate from the access role.
const JOB_TITLE_OPTION_DEFS = [
  { value: 'Content Creator', labelKey: 'teamJobContentCreator' },
  { value: 'Social Media Manager', labelKey: 'teamJobSocialMediaManager' },
  { value: 'Graphic Designer', labelKey: 'teamJobGraphicDesigner' },
  { value: 'Video Editor', labelKey: 'teamJobVideoEditor' },
  { value: 'Copywriter', labelKey: 'teamJobCopywriter' },
  { value: 'SEO Specialist', labelKey: 'teamJobSeoSpecialist' },
  { value: 'Paid Ads Specialist', labelKey: 'teamJobPaidAdsSpecialist' },
  { value: 'Email Marketing Specialist', labelKey: 'teamJobEmailMarketingSpecialist' },
  { value: 'Brand Strategist', labelKey: 'teamJobBrandStrategist' },
  { value: 'Marketing Manager', labelKey: 'teamJobMarketingManager' },
  { value: 'Account Manager', labelKey: 'teamJobAccountManager' },
  { value: 'Project Manager', labelKey: 'teamJobProjectManager' },
  { value: 'UX/UI Designer', labelKey: 'teamJobUxUiDesigner' },
  { value: 'Photographer', labelKey: 'teamJobPhotographer' },
  { value: 'Influencer Manager', labelKey: 'teamJobInfluencerManager' },
  { value: 'PR Specialist', labelKey: 'teamJobPrSpecialist' },
  { value: 'Analytics Specialist', labelKey: 'teamJobAnalyticsSpecialist' },
  { value: '__other__', labelKey: 'teamJobOther' },
] as const;

function getJobTitleOptions(t: TranslateFn) {
  return JOB_TITLE_OPTION_DEFS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
}

function normalizeInviteJobTitle(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (
    lowered === 'select role' ||
    lowered === 'select role…' ||
    lowered === 'اختر الدور' ||
    lowered === 'اختر الدور…'
  ) {
    return null;
  }
  return trimmed;
}

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

function formatWorkspaceRole(role: string | undefined, t: TranslateFn): string {
  const candidate = (role ?? '').toLowerCase();
  const normalized = WORKSPACE_ROLES.includes(candidate as (typeof WORKSPACE_ROLES)[number])
    ? candidate
    : 'member';
  if (normalized === 'owner') return t('wsRoleOwner');
  if (normalized === 'admin') return t('wsRoleAdmin');
  if (normalized === 'viewer') return t('wsRoleViewer');
  return t('wsRoleMember');
}

function formatAccessRole(role: string | null | undefined, t: TranslateFn): string {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'team_member') return t('teamRoleMember');
  if (normalized === 'owner') return t('teamRoleOwner');
  if (normalized === 'admin') return t('teamRoleAdmin');
  if (normalized === 'manager') return t('teamRoleManager');
  if (normalized === 'viewer') return t('teamRoleViewer');
  if (normalized === 'client') return t('teamRoleClient');
  if (!normalized) return t('teamRoleMember');
  return t('teamAccessRoleUnknown', { role: normalized });
}

function formatLastActive(lastActiveRaw: string | null | undefined, t: TranslateFn) {
  if (!lastActiveRaw) return t('teamLastActiveNone');
  const ts = new Date(lastActiveRaw).getTime();
  if (Number.isNaN(ts)) return t('teamLastActiveNone');
  const diff = Date.now() - ts;
  if (diff < 60_000) return t('teamLastActiveJustNow');
  if (diff < 3_600_000) return t('teamLastActiveMinutes', { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('teamLastActiveHours', { n: Math.floor(diff / 3_600_000) });
  if (diff < 604_800_000) return t('teamLastActiveDays', { n: Math.floor(diff / 86_400_000) });
  return t('teamLastActiveDate', { date: new Date(lastActiveRaw).toLocaleDateString() });
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

function formatWorkspaceAccessSummary(access: Array<'os' | 'docs'>, t: TranslateFn): string {
  if (access.length === 2) return t('teamWsSummaryBoth');
  if (access[0] === 'docs') return workspaceLabelUi('docs', t);
  return workspaceLabelUi('os', t);
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

/** Fallback row when a team_member is invited but invitations API failed or is out of sync. */
function buildSyntheticInvitation(member: TeamMember): TeamInvitation {
  const createdMs = member.created_at ? new Date(member.created_at).getTime() : Date.now();
  return {
    id: `synthetic-invite-${member.id}`,
    team_member_id: member.id,
    email: member.email ?? '',
    role: member.role,
    token: '',
    status: 'invited',
    invited_by: null,
    expires_at: new Date(createdMs + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    created_at: member.created_at,
    updated_at: member.updated_at ?? member.created_at,
    team_member: {
      full_name: member.full_name,
      job_title: member.job_title ?? null,
      role: member.role ?? null,
      status: member.status ?? null,
    },
  };
}

// ── RoleField — dropdown + optional custom text input ────────────────────────
function RoleField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useLang();
  const roleOptions = getJobTitleOptions(t);
  const isPreset = roleOptions.some((o) => o.value === value && o.value !== '__other__');
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
        options={roleOptions}
        placeholder={t('teamSelectRole')}
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
          placeholder={t('teamCustomRolePlaceholder')}
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
  const { t } = useLang();
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelFullNameRequired')}
        </label>
        <input
          required
          value={f.full_name}
          onChange={(e) => setF((x) => ({ ...x, full_name: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder={t('teamPlaceholderMemberName')}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelEmail')}
        </label>
        <input
          type="email"
          value={f.email}
          onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder={t('teamPlaceholderEmail')}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelJobTitle')}
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
  const { t } = useLang();
  const accessOpts = getAccessRoleOptions(t);
  const wsOpts = getWorkspaceRoleOptions(t);
  const modOpts = getModuleAccessOptions(t);
  const defaultModOpts = [{ value: '', label: t('teamDefaultOption') }, ...modOpts];
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelFullNameRequired')}
        </label>
        <input
          required
          value={f.full_name}
          onChange={(e) => setF((x) => ({ ...x, full_name: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder={t('teamPlaceholderMemberName')}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelEmailRequired')}
        </label>
        <input
          required
          type="email"
          value={f.email}
          onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder={t('teamPlaceholderEmail')}
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelAccessRoleRequired')}
        </label>
        <SelectDropdown
          value={f.access_role}
          onChange={(v) => setF((x) => ({ ...x, access_role: v }))}
          options={accessOpts}
          placeholder={t('teamSelectAccessLevel')}
          fullWidth
        />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('teamAccessRoleHint')}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelWorkspaceAccessRequired')}
        </p>
        <label
          className="flex items-center justify-between rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            {t('workspaceBrandOs')}
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
            options={wsOpts}
            placeholder={t('teamPlaceholderOsRole')}
            fullWidth
          />
        )}
        <label
          className="flex items-center justify-between rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            {t('workspaceBrandDocs')}
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
            options={wsOpts}
            placeholder={t('teamPlaceholderDocsRole')}
            fullWidth
          />
        )}
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('teamWorkspaceAccessIndependentHint')}
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {t('teamLabelJobTitle')}
        </label>
        <RoleField value={f.job_title} onChange={(v) => setF((x) => ({ ...x, job_title: v }))} />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('teamJobTitleHint')}
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
            {t('teamAdvancedModulePerms')}
          </span>
          {f.show_advanced_permissions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {f.show_advanced_permissions && (
          <div className="space-y-3 px-3 py-3" style={{ background: 'var(--surface)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('teamAdvancedModulePermsHint')}
            </p>
            {f.os_access && (
              <div>
                <p
                  className="mb-2 text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('teamOsModules')}
                </p>
                <div className="space-y-1.5">
                  {OS_MODULES.map((mod) => (
                    <div key={mod} className="flex items-center justify-between gap-2">
                      <span className="text-xs capitalize" style={{ color: 'var(--text)' }}>
                        {osModuleLabel(mod, t)}
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
                        options={defaultModOpts}
                        placeholder={t('teamDefaultOption')}
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
                  {t('teamDocsModules')}
                </p>
                <div className="space-y-1.5">
                  {DOCS_MODULES.map((mod) => (
                    <div key={mod} className="flex items-center justify-between gap-2">
                      <span className="text-xs capitalize" style={{ color: 'var(--text)' }}>
                        {docsModuleLabel(mod, t)}
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
                        options={defaultModOpts}
                        placeholder={t('teamDefaultOption')}
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
        {t('teamInviteEmailFooter')}
      </p>
    </div>
  );
}

// ── Invite status badge ───────────────────────────────────────────────────────
function InviteBadge({ status }: { status: string }) {
  const { t } = useLang();
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    pending: {
      label: t('inviteStatusPending'),
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
    },
    invited: {
      label: t('inviteStatusInvited'),
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
    },
    accepted: {
      label: t('inviteStatusActiveMember'),
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
    },
    expired: {
      label: t('inviteStatusExpired'),
      color: 'var(--text-secondary)',
      bg: 'var(--surface-2)',
    },
    revoked: {
      label: t('inviteStatusCancelled'),
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-bg)',
    },
    cancelled: {
      label: t('inviteStatusCancelled'),
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-bg)',
    },
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
  const { t } = useLang();
  const cfg: Record<ModuleAccess, { color: string; bg: string; label: string }> = {
    full: {
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
      label: t('teamAccessBadgeFull'),
    },
    read: {
      color: 'var(--color-info)',
      bg: 'var(--color-info-bg)',
      label: t('teamAccessBadgeRead'),
    },
    none: {
      color: 'var(--text-secondary)',
      bg: 'var(--surface-2)',
      label: t('teamAccessBadgeNone'),
    },
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
  const { t } = useLang();

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
    if (diff < 3_600_000) return t('relativeMinutesAgo', { n: Math.floor(diff / 60_000) });
    if (diff < 86_400_000) return t('relativeHoursAgo', { n: Math.floor(diff / 3_600_000) });
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
            {t('teamMemberProfileTitle')}
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
                  className="absolute -bottom-1 end-1 flex h-5 w-5 items-center justify-center rounded-full"
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
                  {formatAccessRole(member.role, t)}
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}
                >
                  {t('inviteStatusActiveMember')}
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
            {t('teamWorkspaceAccessSection')}
          </p>
          <div className="flex flex-wrap gap-2">
            {workspaceAccess?.os?.enabled && (
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {workspaceLabelUi('os', t)} · {formatWorkspaceRole(workspaceAccess.os.role, t)}
              </span>
            )}
            {workspaceAccess?.docs?.enabled && (
              <span
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {workspaceLabelUi('docs', t)} · {formatWorkspaceRole(workspaceAccess.docs.role, t)}
              </span>
            )}
            {!workspaceAccess?.os?.enabled && !workspaceAccess?.docs?.enabled && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t('teamNoWorkspaceConfigured')}
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
            <Shield size={12} className="me-1 inline" />
            {t('teamModulePermissions')}
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
                    {t('teamModuleOsShort')}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {OS_MODULES.map((mod) => (
                      <div key={mod} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: 'var(--text)' }}>
                          {osModuleLabel(mod, t)}
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
                    {t('teamModuleDocsShort')}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {DOCS_MODULES.map((mod) => (
                      <div key={mod} className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: 'var(--text)' }}>
                          {docsModuleLabel(mod, t)}
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
              {t('teamPermissionsUnavailable')}
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Activity size={12} className="me-1 inline" />
            {t('teamRecentActivitySection')}
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
              {t('teamNoRecentActivityFound')}
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
              {t('teamEditProfileRole')}
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
              {t('teamRemoveMember')}
            </button>
          </div>
        )}
      </div>
    </AppModal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLang();
  const { role: myRole, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = myRole === 'owner' || myRole === 'admin';
  const workspaceRoleOpts = getWorkspaceRoleOptions(t);

  // ── React Query: fetch and cache team members and invitations ─────────────
  const { data: teamData, isLoading: loading } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const prev = queryClient.getQueryData<{
        members: TeamMember[];
        invitations: TeamInvitation[];
        workspaceAccess: Record<string, Record<string, { enabled: boolean; role: string }>>;
        invitationsLoadFailed?: boolean;
      }>(['team-data']);

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
        : { invitations: (prev?.invitations ?? []) as TeamInvitation[] };
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
        invitationsLoadFailed: !invitesRes.ok,
      };
    },
  });

  const { data: teamEmailConfig } = useQuery({
    queryKey: ['team-email-config'],
    queryFn: async () => {
      const res = await fetch('/api/team/email-config', { credentials: 'include' });
      if (!res.ok) {
        return { transactionalEmailConfigured: true, inviteAppUrlConfigured: true };
      }
      return (await res.json()) as {
        transactionalEmailConfigured: boolean;
        inviteAppUrlConfigured: boolean;
      };
    },
    enabled: canManage,
  });

  const members = useMemo(() => teamData?.members ?? [], [teamData?.members]);
  const invitations = useMemo(() => teamData?.invitations ?? [], [teamData?.invitations]);
  const workspaceAccessByEmail = teamData?.workspaceAccess ?? {};
  const invitationsLoadFailed = Boolean(teamData?.invitationsLoadFailed);

  const [saving, setSaving] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [actionError, setActionError] = useState('');
  const [inviteErrorCode, setInviteErrorCode] = useState<string | null>(null);

  // Modals
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
  const [pendingCancelInvite, setPendingCancelInvite] = useState<TeamInvitation | null>(null);
  const removeMemberMutation = useRemoveTeamMember();

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

  useEffect(() => {
    if (searchParams.get('invite') !== '1') return;
    setInviteOpen(true);
    const q = new URLSearchParams(searchParams.toString());
    q.delete('invite');
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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

  const pendingInvitesFromApi = useMemo(
    () =>
      uniqueInvitations.filter((invite) =>
        ACTIVE_INVITE_STATUSES.has((invite.status ?? '').toLowerCase()),
      ),
    [uniqueInvitations],
  );

  const pendingInvites = useMemo(() => {
    const fromApi = [...pendingInvitesFromApi];
    const seenMemberIds = new Set(
      fromApi.map((i) => i.team_member_id).filter((id): id is string => Boolean(id)),
    );
    const out: TeamInvitation[] = [...fromApi];
    for (const m of members) {
      if (m.role === 'owner') continue;
      const st = (m.status ?? '').toLowerCase();
      if (st !== 'invited' && st !== 'pending') continue;
      if (seenMemberIds.has(m.id)) continue;
      seenMemberIds.add(m.id);
      out.push(buildSyntheticInvitation(m));
    }
    return out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [pendingInvitesFromApi, members]);

  const invitationHistory = useMemo(
    () =>
      uniqueInvitations.filter(
        (invite) => !ACTIVE_INVITE_STATUSES.has((invite.status ?? '').toLowerCase()),
      ),
    [uniqueInvitations],
  );

  const inviteEmailNormalized = inviteForm.email.trim().toLowerCase();
  const existingMemberByInviteEmail = useMemo(() => {
    if (!inviteEmailNormalized) return null;
    return (
      members.find(
        (member) =>
          (member.email ?? '').trim().toLowerCase() === inviteEmailNormalized &&
          (!member.status || member.status === 'active'),
      ) ?? null
    );
  }, [members, inviteEmailNormalized]);

  useEffect(() => {
    if (inviteErrorCode === 'ALREADY_MEMBER') {
      setInviteErrorCode(null);
      setActionError('');
    }
  }, [inviteForm.email, inviteErrorCode]);

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setInviteErrorCode(null);

    if (existingMemberByInviteEmail) {
      setInviteErrorCode('ALREADY_MEMBER');
      setActionError('This person is already in your team.');
      return;
    }

    if (
      !inviteForm.full_name.trim() ||
      !inviteForm.email.trim() ||
      !inviteForm.access_role.trim()
    ) {
      setActionError(t('teamInviteRequiredFields'));
      return;
    }
    if (!SIMPLE_EMAIL_RE.test(inviteForm.email.trim())) {
      setActionError('Please enter a valid email address.');
      return;
    }
    if (!inviteForm.os_access && !inviteForm.docs_access) {
      setActionError(t('teamInviteWorkspaceRequired'));
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
          job_title: normalizeInviteJobTitle(inviteForm.job_title),
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
        if (data?.code === 'ALREADY_MEMBER') {
          setInviteErrorCode('ALREADY_MEMBER');
          setActionError('This person is already in your team.');
          return;
        }
        const exactDbError =
          process.env.NODE_ENV === 'development' ? (data.dbError ?? data.error ?? '') : '';
        setActionError(exactDbError || data.error || t('teamInviteFailed'));
        if (data.dbError) console.error('[team] invitation insert error:', data.dbError);
        return;
      }
      if (!hasInviteInsertResult(data)) {
        setActionError(t('teamInviteNoRowReturned'));
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
                invitationsLoadFailed?: boolean;
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
              invitationsLoadFailed: false,
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
            invitationsLoadFailed: false,
          };
        },
      );

      setInviteOpen(false);
      setInviteForm({ ...blankInviteForm });
      const emailSent = (data as { emailSent?: boolean }).emailSent === true;
      const skipReason = (data as { emailSkippedReason?: string }).emailSkippedReason;
      if (emailSent) {
        toast('Invitation sent', 'success');
      } else {
        toast(
          `Invite member / ${inviteForm.email}: ${skipReason ?? t('teamInviteCreatedNoEmail', { email: inviteForm.email })}`,
          'warning',
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('teamNetworkErrorRetry'));
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
        throw new Error(payload.error ?? t('teamFailedUpdateMemberApi'));
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
          throw new Error(payload.error ?? t('teamFailedUpdateWorkspacePerms'));
        }
      }
      setEditMember(null);
      toast(
        `Update member / ${editForm.full_name || editMember.full_name}: ${t('teamMemberUpdated')}`,
        'success',
      );
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch (err: unknown) {
      toast(
        `Update member / ${editForm.full_name || editMember.full_name}: ${err instanceof Error ? err.message : t('teamFailedUpdateMember')}`,
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteMember) return;
    // Owner is never deletable — guard at both UI and API level.
    if (deleteMember.role === 'owner') {
      toast(`Remove member / ${deleteMember.full_name}: ${t('teamOwnerCannotRemove')}`, 'error');
      setDeleteMember(null);
      return;
    }
    setRemovingMember(true);
    try {
      const membershipId = deleteMember.membership_id ?? deleteMember.id;
      await removeMemberMutation.mutateAsync(membershipId);
      setDeleteMember(null);
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch (err) {
      toast(
        `Remove member / ${deleteMember.full_name}: ${err instanceof Error ? err.message : t('teamNetworkErrorRetry')}`,
        'error',
      );
    } finally {
      setRemovingMember(false);
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
      const data = (await res.json()) as {
        error?: string;
        emailSent?: boolean;
        emailSkippedReason?: string;
      };
      if (!res.ok) {
        toast(
          `Resend invite / ${invitation.email}: ${data.error ?? t('teamFailedResendInvite')}`,
          'error',
        );
        return;
      }
      if (data.emailSent === false) {
        toast(
          `Resend invite / ${invitation.email}: ${data.emailSkippedReason ?? t('teamInviteRenewedNoEmail', { email: invitation.email })}`,
          'warning',
        );
        void queryClient.invalidateQueries({ queryKey: ['team-data'] });
        return;
      }
      toast(
        `Resend invite / ${invitation.email}: ${t('teamInviteResentTo', { email: invitation.email })}`,
        'success',
      );
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch {
      toast(`Resend invite / ${invitation.email}: ${t('teamNetworkErrorRetry')}`, 'error');
    }
  };

  // ── Cancel invite ─────────────────────────────────────────────────────────
  const handleCancelInvite = async () => {
    if (!pendingCancelInvite) return;
    setCancellingInvite(true);
    try {
      const res = await fetch('/api/team/invite/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: pendingCancelInvite.team_member_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(
          `Cancel invite / ${pendingCancelInvite.email}: ${data.error ?? t('teamFailedRevokeInvite')}`,
          'error',
        );
        return;
      }
      toast(
        `Cancel invite / ${pendingCancelInvite.email}: ${t('teamInvitationCancelled')}`,
        'info',
      );
      setPendingCancelInvite(null);
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch {
      toast(`Cancel invite / ${pendingCancelInvite.email}: ${t('teamNetworkErrorRetry')}`, 'error');
    } finally {
      setCancellingInvite(false);
    }
  };

  const handleCopyInviteLink = async (invitation: TeamInvitation) => {
    if (!invitation.token) {
      toast(`Copy invite link / ${invitation.email}: ${t('teamInviteLinkUnavailable')}`, 'error');
      return;
    }

    const inviteUrl = `${window.location.origin}/invite/${encodeURIComponent(invitation.token)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast(`Copy invite link / ${invitation.email}: ${t('teamInviteLinkCopied')}`, 'success');
    } catch {
      toast(`Copy invite link / ${invitation.email}: ${t('teamFailedCopyInvite')}`, 'error');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const ownerMembers = members.filter(
    (m) => m.role === 'owner' && (!m.status || m.status === 'active'),
  );
  const ownerMembersForDisplay = useMemo(() => {
    const raw =
      ownerMembers.length > 0
        ? ownerMembers
        : myRole === 'owner' && user.id && user.email
          ? [
              {
                id: user.id,
                full_name: user.name || t('teamWorkspaceOwnerDisplay'),
                email: user.email,
                role: 'owner',
                status: 'active',
                created_at: new Date().toISOString(),
              } satisfies TeamMember,
            ]
          : [];
    return raw.map((m) => {
      if (m.role !== 'owner' || !looksLikeUuid(m.full_name)) return m;
      const self =
        Boolean(user?.id) &&
        (m.id === user.id || m.profile_id === user.id || (m.email && m.email === user.email));
      if (self) {
        const fromSession =
          (user.name && user.name.trim()) || user.email?.split('@')[0]?.trim() || '';
        if (fromSession) return { ...m, full_name: fromSession };
      }
      return { ...m, full_name: t('teamWorkspaceOwnerDisplay') };
    });
  }, [ownerMembers, myRole, user.id, user.email, user.name, t]);
  const activeMembers = members
    .filter((m) => m.role !== 'owner' && (!m.status || m.status === 'active'))
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));

  const hasAnyTeamData =
    ownerMembersForDisplay.length > 0 || activeMembers.length > 0 || pendingInvites.length > 0;

  return (
    <PageShell className="max-w-6xl space-y-6">
      <PageHeader
        title={t('team')}
        subtitle={t('teamSubtitleCounts', {
          active: activeMembers.length + ownerMembersForDisplay.length,
          pending: pendingInvites.length,
        })}
        actions={
          canManage ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setActionError('');
                setInviteErrorCode(null);
                setInviteOpen(true);
              }}
            >
              <Send size={15} />
              {t('teamInviteMember')}
            </Button>
          ) : undefined
        }
      />

      {invitationsLoadFailed && !loading ? (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-warning-border, var(--border))',
            background: 'var(--color-warning-bg, var(--surface-2))',
            color: 'var(--color-warning, var(--text))',
          }}
        >
          {t('teamInvitationsLoadFailed')}
        </p>
      ) : null}

      {canManage && teamEmailConfig && !teamEmailConfig.transactionalEmailConfigured && !loading ? (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('teamEmailNotConfiguredHint')}
        </p>
      ) : null}

      {canManage &&
      teamEmailConfig &&
      teamEmailConfig.transactionalEmailConfigured &&
      !teamEmailConfig.inviteAppUrlConfigured &&
      !loading ? (
        <p
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--color-warning-border, var(--border))',
            background: 'var(--color-warning-bg, var(--surface-2))',
            color: 'var(--color-warning, var(--text))',
          }}
        >
          {t('teamInviteUrlNotConfigured')}
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : !hasAnyTeamData ? (
        <EmptyState
          icon={Users}
          title={t('noTeamMembers')}
          description={t('noTeamMembersDesc')}
          action={
            canManage ? (
              <Button type="button" variant="primary" onClick={() => setInviteOpen(true)}>
                <Send size={15} />
                {t('teamInviteMember')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card padding="sm" className="sm:p-6">
            <CardContent className="space-y-4 !p-0">
              <SectionHeader
                icon={<Crown size={14} />}
                label={t('teamSectionOwner')}
                count={ownerMembersForDisplay.length}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ownerMembersForDisplay.map((m) => (
                  <OwnerCard key={m.id} member={m} canManage={canManage} onEdit={openEdit} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card padding="sm" className="sm:p-6">
            <CardContent className="space-y-4 !p-0">
              <SectionHeader
                icon={<CheckCircle size={14} />}
                label={t('teamSectionActiveMembers')}
                count={activeMembers.length}
              />
              {activeMembers.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('noActiveMembers')}</p>
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
            </CardContent>
          </Card>

          <Card padding="sm" className="sm:p-6">
            <CardContent className="space-y-4 !p-0">
              <SectionHeader
                icon={<Clock size={14} />}
                label={t('teamSectionPendingInvites')}
                count={pendingInvites.length}
              />
              {pendingInvites.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">{t('noPendingInvitations')}</p>
              ) : (
                <div className="space-y-3">
                  {pendingInvites.map((invitation) => (
                    <PendingInvitationRow
                      key={invitation.id}
                      invitation={invitation}
                      canManage={canManage}
                      onResend={handleResend}
                      onCopyLink={handleCopyInviteLink}
                      onCancel={(invitation) => setPendingCancelInvite(invitation)}
                    />
                  ))}
                </div>
              )}
              {invitationHistory.length > 0 && (
                <div className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    {t('teamInviteHistory')}
                  </p>
                  <div className="space-y-2">
                    {invitationHistory.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-[var(--text)]">{invitation.email}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {invitation.role ? `${formatAccessRole(invitation.role, t)} · ` : ''}
                            {t('teamCreatedOn', {
                              date: new Date(invitation.created_at).toLocaleDateString(),
                            })}
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
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Invite Modal ──────────────────────────────────────────────────── */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t('teamInviteModalTitle')}
        size="sm"
      >
        <form onSubmit={handleInvite} className="space-y-4" noValidate>
          <InviteForm f={inviteForm} setF={setInviteForm} />
          {actionError && (
            <div className="space-y-2">
              <p
                className="rounded-xl px-3 py-2 text-sm"
                style={
                  inviteErrorCode === 'ALREADY_MEMBER'
                    ? {
                        background: 'var(--color-warning-bg, var(--surface-2))',
                        color: 'var(--color-warning, var(--text))',
                        border: '1px solid var(--color-warning-border, var(--border))',
                      }
                    : { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }
                }
              >
                {actionError}
              </p>
              {inviteErrorCode === 'ALREADY_MEMBER' && existingMemberByInviteEmail ? (
                <button
                  type="button"
                  className="text-xs font-medium underline underline-offset-2"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => {
                    setInviteOpen(false);
                    setPanelMember(existingMemberByInviteEmail);
                    setInviteErrorCode(null);
                    setActionError('');
                  }}
                >
                  View existing team member
                </button>
              ) : null}
            </div>
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
              disabled={saving || inviteErrorCode === 'ALREADY_MEMBER'}
              className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              <Send size={14} />
              {saving ? t('teamSending') : t('teamSendInvite')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={!!editMember}
        onClose={() => setEditMember(null)}
        title={t('teamEditMemberTitle')}
        size="sm"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <MemberForm f={editForm} setF={setEditForm} />
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {t('teamWorkspaceAccessSection')}
            </p>
            <label
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                {t('workspaceBrandOs')}
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
                options={workspaceRoleOpts}
                placeholder={t('teamPlaceholderOsRole')}
                fullWidth
              />
            )}
            <label
              className="flex items-center justify-between rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                {t('workspaceBrandDocs')}
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
                options={workspaceRoleOpts}
                placeholder={t('teamPlaceholderDocsRole')}
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
      <ConfirmDialog
        open={Boolean(deleteMember)}
        title={t('teamRemoveMemberTitle')}
        description={
          deleteMember
            ? `${t('teamRemoveMemberLead')} ${deleteMember.full_name} ${t('teamRemoveMemberTrail')}`
            : t('teamRemoveMemberLead')
        }
        confirmLabel={t('teamRemove')}
        cancelLabel={t('cancel')}
        destructive
        loading={removingMember}
        onCancel={() => setDeleteMember(null)}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={Boolean(pendingCancelInvite)}
        title="Cancel invitation"
        description={
          pendingCancelInvite
            ? `Cancel invitation for "${pendingCancelInvite.email}"? This action cannot be undone.`
            : 'Cancel invitation?'
        }
        confirmLabel="Cancel invitation"
        cancelLabel={t('cancel')}
        destructive
        loading={cancellingInvite}
        onCancel={() => {
          if (cancellingInvite) return;
          setPendingCancelInvite(null);
        }}
        onConfirm={handleCancelInvite}
      />

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
    </PageShell>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count }: { icon: ReactNode; label: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-[var(--border)] pb-2">
      <span className="text-[var(--text-secondary)]">{icon}</span>
      <h2 className="text-sm font-semibold text-[var(--text-secondary)]">{label}</h2>
      {count !== undefined && (
        <span className="ms-1 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
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
  const { t } = useLang();
  return (
    <div
      className="shadow-card relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 p-5"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--accent)',
      }}
    >
      {/* subtle accent stripe at top */}
      <div
        className="absolute end-0 start-0 top-0 h-0.5 rounded-t-xl"
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
            className="absolute -bottom-1 end-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
            title={t('teamWorkspaceOwnerDisplay')}
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
            {t('teamSectionOwner')}
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
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {formatLastActive(member.updated_at ?? member.created_at, t)}
          </p>
        </div>
        {/* Edit only — owner is never deletable */}
        {canManage && (
          <button
            onClick={() => onEdit(member)}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-secondary)' }}
            title={t('teamEditOwnerProfile')}
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
  const { t } = useLang();
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
  const roleLabel = formatAccessRole(invitation.role ?? member?.role ?? 'team_member', t);
  const status = CANCELLATION_STATUSES.has((invitation.status ?? '').toLowerCase())
    ? 'cancelled'
    : invitation.status;
  const canCancel = ACTIVE_INVITE_STATUSES.has((invitation.status ?? '').toLowerCase());
  const canResend = canCancel || invitation.status === 'expired';
  const workspaceAccess = parseInviteWorkspaceAccess(invitation.workspace_access);
  const workspaceRoles = parseInviteWorkspaceRoles(invitation.workspace_roles);
  const workspaceSummary = formatWorkspaceAccessSummary(workspaceAccess, t);

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
            {roleLabel} ·{' '}
            {t('teamPendingRowInvited', {
              date: new Date(invitation.created_at).toLocaleDateString(),
            })}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {workspaceAccess.map((workspace) => (
              <span
                key={`${invitation.id}-${workspace}`}
                className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
              >
                {workspaceLabelUi(workspace, t)} ·{' '}
                {formatWorkspaceRole(workspaceRoles[workspace], t)}
              </span>
            ))}
            {workspaceAccess.length === 0 && (
              <span
                className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
              >
                {t('teamFallbackOsMember')}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {t('teamWorkspaceAccessLabel', { summary: workspaceSummary })}
          </p>
          {invitation.expires_at && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('teamExpires', { date: new Date(invitation.expires_at).toLocaleDateString() })}
            </p>
          )}
        </div>
        <InviteBadge status={status} />
      </div>

      {canManage && (
        <div className="flex items-center gap-2">
          {canResend && (
            <Button
              type="button"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() => onResend(invitation)}
            >
              <RotateCcw size={12} />
              {t('teamResend')}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => onCopyLink(invitation)}
            disabled={!invitation.token}
            className="h-8 text-xs"
          >
            <Copy size={12} />
            {t('teamCopyInviteLink')}
          </Button>
          {canCancel && (
            <Button
              type="button"
              variant="danger"
              className="h-8 text-xs"
              onClick={() => onCancel(invitation)}
            >
              <XCircle size={12} />
              {t('teamCancelInvitation')}
            </Button>
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
  const { t } = useLang();
  const isInvited = member.status === 'invited' || member.status === 'pending';
  const isInteractive = !isInvited && !!onView;

  return (
    <div
      className={
        'shadow-card flex flex-col gap-3 rounded-2xl border p-5 transition-shadow' +
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
                {t('inviteStatusActiveMember')}
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
              {formatAccessRole(member.role, t)}
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
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {formatLastActive(member.updated_at ?? member.created_at, t)}
          </p>
          <div className="mt-1">
            <p
              id={`member-access-${member.id}`}
              className="text-[11px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('teamMemberAccessLabel')}
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
                  {workspaceLabelUi('os', t)} · {formatWorkspaceRole(workspaceAccess.os.role, t)}
                </li>
              )}
              {workspaceAccess?.docs?.enabled && (
                <li
                  className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  {workspaceLabelUi('docs', t)} ·{' '}
                  {formatWorkspaceRole(workspaceAccess.docs.role, t)}
                </li>
              )}
              {!workspaceAccess?.os?.enabled && !workspaceAccess?.docs?.enabled && (
                <li
                  className="inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  {t('teamNoWorkspaceAccess')}
                </li>
              )}
            </ul>
          </div>
          {invitation && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('teamPendingRowInvited', {
                date: new Date(invitation.created_at).toLocaleDateString(),
              })}
              {invitation.expires_at &&
                t('teamInviteExpiresLine', {
                  date: new Date(invitation.expires_at).toLocaleDateString(),
                })}
            </p>
          )}
        </div>
        {canManage && !isInvited && (
          <div className="flex shrink-0 items-center gap-1">
            <EntityActionsMenu
              onEdit={() => onEdit(member)}
              onDelete={() => onDelete(member)}
              editLabel={t('editAction')}
              deleteLabel={t('teamRemove')}
            />
          </div>
        )}
      </div>

      {/* Invite actions row */}
    </div>
  );
}

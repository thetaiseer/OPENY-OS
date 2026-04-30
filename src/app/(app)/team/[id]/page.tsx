'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, Mail, Shield, UserCircle2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { ActivityLogEntry, Task, TeamMember } from '@/lib/types';

type DetailResponse = {
  member: TeamMember | null;
  assignedTasks: Task[];
  recentActivity: ActivityLogEntry[];
};

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'team_member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'client', label: 'Client' },
];

export default function TeamMemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const canManage = role === 'owner' || role === 'admin';

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'team_member',
    job_title: '',
  });

  const { data, isLoading } = useQuery<DetailResponse>({
    queryKey: ['team-member-detail', id],
    queryFn: async () => {
      const membersRes = await fetch('/api/team/members', { credentials: 'include' });
      const membersPayload = (await membersRes.json()) as { members?: TeamMember[] };
      const member =
        (membersPayload.members ?? []).find((candidate) => candidate.id === id) ?? null;

      if (!member) {
        return { member: null, assignedTasks: [], recentActivity: [] };
      }

      const [tasksRes, activityRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .or(`assigned_to.eq.${member.id},assignee_id.eq.${member.profile_id ?? member.id}`)
          .order('created_at', { ascending: false })
          .limit(20),
        fetch(`/api/activity-timeline?limit=20&category=team&actor_id=${member.profile_id ?? ''}`, {
          credentials: 'include',
        }),
      ]);

      const activitiesPayload = (await activityRes.json().catch(() => ({}))) as {
        activities?: ActivityLogEntry[];
      };

      return {
        member,
        assignedTasks: ((tasksRes.data ?? []) as Task[]).slice(0, 10),
        recentActivity: (activitiesPayload.activities ?? []).slice(0, 10),
      };
    },
    enabled: Boolean(id),
  });

  const member = data?.member ?? null;
  const assignedTasks = data?.assignedTasks ?? [];
  const recentActivity = data?.recentActivity ?? [];

  const initials = useMemo(() => {
    if (!member?.full_name) return 'U';
    return member.full_name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }, [member?.full_name]);

  const openEdit = () => {
    if (!member) return;
    setForm({
      full_name: member.full_name ?? '',
      email: member.email ?? '',
      role: member.role ?? 'team_member',
      job_title: member.job_title ?? '',
    });
    setSaveError(null);
    setEditOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!member) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/team/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? 'Failed to save profile');
      }
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['team-member-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['team-data'] });
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-10 text-center text-sm text-secondary">
            Loading member profile...
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!member) {
    return (
      <PageShell>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-secondary">Member not found.</p>
            <Button type="button" variant="secondary" onClick={() => router.push('/team')}>
              Back to team
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title={member.full_name}
        subtitle={member.job_title || 'Team member profile'}
        actions={
          canManage ? (
            <Button type="button" variant="secondary" onClick={openEdit}>
              Edit profile
            </Button>
          ) : undefined
        }
      />

      <Button type="button" variant="ghost" onClick={() => router.push('/team')}>
        <ArrowLeft size={14} />
        Back to team
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-sm font-semibold text-[var(--accent-foreground)]">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">{member.full_name}</p>
              <p className="text-xs text-secondary">{member.email || 'No email'}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="inline-flex items-center gap-2 text-primary">
              <Shield size={14} />
              Role: <span className="font-semibold capitalize">{member.role ?? 'team_member'}</span>
            </p>
            <p className="inline-flex items-center gap-2 text-secondary">
              <UserCircle2 size={14} />
              Job title: {member.job_title || 'Not set'}
            </p>
            <p className="inline-flex items-center gap-2 text-secondary">
              <Mail size={14} />
              Contact: {member.email || 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {assignedTasks.length === 0 ? (
            <p className="text-sm text-secondary">No assigned tasks.</p>
          ) : (
            <div className="space-y-2">
              {assignedTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-control border border-border bg-elevated px-3 py-2"
                >
                  <p className="text-sm font-medium text-primary">{task.title}</p>
                  <p className="text-xs text-secondary">{task.status}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Activity size={16} />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-secondary">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-control border border-border bg-elevated px-3 py-2"
                >
                  <p className="text-sm text-primary">{entry.title ?? entry.description}</p>
                  <p className="text-xs text-secondary">
                    {new Date(entry.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Team Member">
        <form onSubmit={handleSave} className="space-y-4">
          {saveError ? (
            <div className="border-danger/30 bg-danger/10 text-danger rounded-control border px-3 py-2 text-sm">
              {saveError}
            </div>
          ) : null}
          <Field label="Full name">
            <Input
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </Field>
          <Field label="Role">
            <SelectDropdown
              fullWidth
              value={form.role}
              onChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
              options={ROLE_OPTIONS}
            />
          </Field>
          <Field label="Job title">
            <Input
              value={form.job_title}
              onChange={(event) => setForm((prev) => ({ ...prev, job_title: event.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageShell>
  );
}

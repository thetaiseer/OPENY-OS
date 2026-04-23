'use client';

import { useAuth } from '@/context/auth-context';
import { User, Mail, ShieldCheck, Clock } from 'lucide-react';

export default function AccountPage() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Account
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your profile details
        </p>
      </div>

      {/* Avatar + name */}
      <div
        className="rounded-2xl border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              {user.name || '—'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div
        className="rounded-2xl border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Row icon={<User size={16} />} label="Name" value={user.name || '—'} />
        <Row icon={<Mail size={16} />} label="Email" value={user.email || '—'} />
        <Row
          icon={<ShieldCheck size={16} />}
          label="Role"
          value={
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              {role}
            </span>
          }
        />
        {(() => {
          const createdAt = (user as unknown as { created_at?: string }).created_at;
          return createdAt ? (
            <Row
              icon={<Clock size={16} />}
              label="Member since"
              value={new Date(createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          ) : null;
        })()}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-4 border-b px-6 py-4 last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <p className="w-28 shrink-0 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="flex-1 text-sm" style={{ color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AlertTriangle, User, Mail, ShieldCheck, Clock, Wrench } from 'lucide-react';

export default function AccountPage() {
  const { user, role, loading, profileMissing, repairProfile } = useAuth();
  const [repairing, setRepairing] = useState(false);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [repairDone, setRepairDone] = useState(false);

  async function handleRepair() {
    setRepairing(true);
    setRepairError(null);
    setRepairDone(false);
    try {
      await repairProfile();
      setRepairDone(true);
    } catch (err: unknown) {
      setRepairError(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setRepairing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Account</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your profile details</p>
      </div>

      {/* Profile missing warning */}
      {profileMissing && !repairDone && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}
        >
          <AlertTriangle size={18} style={{ color: '#ca8a04' }} className="shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm" style={{ color: '#ca8a04' }}>
              Your profile row was not found in the database. Role defaults to &quot;team&quot;.
            </p>
            {repairError && (
              <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{repairError}</p>
            )}
            <button
              onClick={handleRepair}
              disabled={repairing}
              className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.35)' }}
            >
              <Wrench size={13} />
              {repairing ? 'Repairing…' : 'Repair Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Repair success */}
      {repairDone && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}
        >
          <ShieldCheck size={18} style={{ color: '#16a34a' }} className="shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: '#16a34a' }}>
            Profile repaired successfully. Your role has been updated.
          </p>
        </div>
      )}

      {/* Avatar + name */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{user.name || '—'}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <Row icon={<User size={16} />} label="Name" value={user.name || '—'} />
        <Row icon={<Mail size={16} />} label="Email" value={user.email || '—'} />
        <Row
          icon={<ShieldCheck size={16} />}
          label="Role"
          value={
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
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
                year: 'numeric', month: 'long', day: 'numeric',
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
      className="flex items-center gap-4 px-6 py-4 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <p className="text-sm w-28 shrink-0 font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>
        {value}
      </p>
    </div>
  );
}

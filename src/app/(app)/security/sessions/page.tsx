'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Monitor, Smartphone, Tablet, Globe, Clock, Shield,
  ShieldAlert, LogOut, RefreshCw, Loader2, AlertTriangle,
  CheckCircle2, MapPin, Wifi, WifiOff,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id:           string;
  user_id:      string;
  ip_address:   string | null;
  country:      string | null;
  city:         string | null;
  user_agent:   string | null;
  browser:      string | null;
  os:           string | null;
  device_type:  string | null;
  is_active:    boolean;
  is_current:   boolean;
  last_seen_at: string;
  created_at:   string;
  revoked_at:   string | null;
  revoked_by:   string | null;
  risk_flag:    boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch { return iso; }
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60)  return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)  return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)    return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch { return iso; }
}

function isActiveSession(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000; // 10 minutes
}

function DeviceIcon({ type }: { type: string | null }) {
  const cls = 'shrink-0';
  if (type === 'Mobile')  return <Smartphone size={20} className={cls} />;
  if (type === 'Tablet')  return <Tablet     size={20} className={cls} />;
  return                         <Monitor    size={20} className={cls} />;
}

function StatusBadge({ session }: { session: Session }) {
  if (!session.is_active) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(107,114,128,0.10)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.25)' }}>
        <WifiOff size={10} /> Signed out
      </span>
    );
  }
  if (session.is_current) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(22,163,74,0.10)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)' }}>
        <Wifi size={10} /> Current device
      </span>
    );
  }
  if (isActiveSession(session.last_seen_at)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-glow)' }}>
        <Wifi size={10} /> Active now
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: 'rgba(234,179,8,0.10)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.25)' }}>
      <WifiOff size={10} /> Idle
    </span>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onRevoke,
  revoking,
}: {
  session:  Session;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  const deviceLabel = [session.browser, session.os].filter(Boolean).join(' on ') || 'Unknown device';
  const location    = [session.city, session.country].filter(Boolean).join(', ') || 'Unknown location';

  return (
    <div
      className="rounded-2xl border p-5 space-y-4 transition-colors"
      style={{
        background:   session.is_current ? 'var(--accent-soft)' : 'var(--surface)',
        borderColor:  session.risk_flag  ? 'rgba(239,68,68,0.4)'
                    : session.is_current ? 'var(--accent)'
                    : 'var(--border)',
      }}
    >
      {/* Risk banner */}
      {session.risk_flag && session.is_active && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.20)' }}>
          <AlertTriangle size={13} className="shrink-0" />
          Suspicious login — new country or location detected
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5" style={{ color: session.is_current ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <DeviceIcon type={session.device_type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
              {session.device_type ?? 'Device'} — {deviceLabel}
            </span>
            <StatusBadge session={session} />
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Detail icon={<MapPin size={13} />}  label="Location"    value={location} />
        <Detail icon={<Globe size={13} />}   label="IP Address"  value={session.ip_address ?? '—'} />
        <Detail icon={<Clock size={13} />}   label="First login" value={formatDate(session.created_at)} />
        <Detail icon={<Clock size={13} />}   label="Last active"
          value={session.is_active ? formatRelative(session.last_seen_at) : (session.revoked_at ? `Signed out ${formatRelative(session.revoked_at)}` : '—')} />
      </div>

      {/* Actions */}
      {session.is_active && (
        <div className="pt-1">
          <button
            onClick={() => onRevoke(session.id)}
            disabled={revoking}
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background:  session.is_current ? 'rgba(239,68,68,0.10)' : 'var(--surface-2)',
              color:       session.is_current ? '#ef4444' : 'var(--text-secondary)',
              border:      session.is_current ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
            }}
          >
            {revoking ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
            {session.is_current ? 'Sign out this device' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { signOut } = useAuth();

  const [sessions,       setSessions]       = useState<Session[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [revoking,       setRevoking]       = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [successMsg,     setSuccessMsg]     = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/sessions');
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = await res.json() as { sessions: Session[] };
      setSessions(data.sessions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);

      const isCurrentSession = sessions.find(s => s.id === id)?.is_current;
      if (isCurrentSession) {
        await signOut();
        return;
      }
      setSuccessMsg('Session signed out.');
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/auth/sessions/revoke-others', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      setSuccessMsg('All other devices have been signed out.');
      await loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to revoke other sessions');
    } finally {
      setRevokingOthers(false);
    }
  }

  const activeSessions  = sessions.filter(s => s.is_active);
  const revokedSessions = sessions.filter(s => !s.is_active);
  const currentSession  = sessions.find(s => s.is_current);
  const otherActive     = activeSessions.filter(s => !s.is_current);
  const hasRiskFlags    = activeSessions.some(s => s.risk_flag);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3">
          <Shield size={24} style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Security</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Manage your active sessions and review login history.
        </p>
      </div>

      {/* Risk alert */}
      {hasRiskFlags && (
        <div className="flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <ShieldAlert size={18} style={{ color: '#ef4444' }} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Suspicious login detected</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              One or more logins were flagged as suspicious (new country or location).
              If you don&apos;t recognise them, sign those devices out immediately.
            </p>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
          <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
          <p className="text-sm" style={{ color: '#16a34a' }}>{successMsg}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl p-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Current session */}
          {currentSession && (
            <section className="space-y-3">
              <SectionHeader label="Current device" />
              <SessionCard
                session={currentSession}
                onRevoke={handleRevoke}
                revoking={revoking === currentSession.id}
              />
            </section>
          )}

          {/* Other active sessions */}
          {otherActive.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionHeader label={`Other active sessions (${otherActive.length})`} />
                <button
                  onClick={handleRevokeOthers}
                  disabled={revokingOthers}
                  className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                  {revokingOthers
                    ? <Loader2 size={12} className="animate-spin" />
                    : <LogOut size={12} />}
                  Sign out all other devices
                </button>
              </div>
              <div className="space-y-3">
                {otherActive.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onRevoke={handleRevoke}
                    revoking={revoking === s.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* No other sessions */}
          {activeSessions.length <= 1 && (
            <div className="text-center py-6 rounded-2xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <Shield size={32} className="mx-auto mb-2" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {sessions.length === 0
                  ? 'No sessions found.'
                  : 'No other active sessions. You\u2019re only logged in from this device.'}
              </p>
            </div>
          )}

          {/* Login history */}
          {revokedSessions.length > 0 && (
            <section className="space-y-3">
              <SectionHeader label={`Login history (${revokedSessions.length})`} />
              <div className="space-y-3">
                {revokedSessions.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onRevoke={handleRevoke}
                    revoking={revoking === s.id}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={loadSessions}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
      {label}
    </h2>
  );
}

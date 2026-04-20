import Link from 'next/link';

export default function InvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg, #f9fafb)' }}>
      <div className="w-full max-w-md rounded-2xl border shadow-xl overflow-hidden" style={{ background: '#ffffff', borderColor: '#e5e7eb' }}>
        <div className="px-8 py-7 text-center" style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}>
          <h1 className="text-2xl font-bold text-white tracking-tight">OPENY OS</h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Access Managed by Admin
          </p>
        </div>
        <div className="px-8 py-8 text-center space-y-4">
          <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Self-service signup is disabled</h2>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Access is provided by your organization administrator.
          </p>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Contact your workspace admin to get access.
          </p>
          <Link
            href="/"
            className="inline-block h-10 px-6 rounded-lg text-sm font-semibold text-white leading-10"
            style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)' }}
          >
            Go to Login →
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { ShieldOff } from 'lucide-react';

interface AccessDeniedProps {
  message?: string;
}

export default function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-6">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)' }}
      >
        <ShieldOff size={28} style={{ color: '#ef4444' }} />
      </div>
      <div>
        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
          Access Denied
        </h2>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
          {message ?? 'You do not have permission to view this page. Contact your workspace owner or admin.'}
        </p>
      </div>
    </div>
  );
}

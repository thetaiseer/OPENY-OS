'use client';

import Link from 'next/link';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';

export default function ClientProfileSelector({
  profiles,
  selectedClientId,
  onSelectClientId,
  label = 'Client Profile',
}: {
  profiles: DocsClientProfile[];
  selectedClientId: string;
  onSelectClientId: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        <Link href="/docs/documents/client-profiles" className="text-[11px] hover:underline" style={{ color: 'var(--accent)' }}>
          Manage clients & templates
        </Link>
      </div>
      <select
        className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]"
        value={selectedClientId}
        onChange={(e) => onSelectClientId(e.target.value)}
      >
        <option value="">Other / New Client (Manual)</option>
        {profiles.map((profile) => (
          <option key={profile.client_id} value={profile.client_id}>
            {profile.client_name}
          </option>
        ))}
      </select>
    </div>
  );
}

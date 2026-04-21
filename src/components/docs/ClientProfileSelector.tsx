'use client';

import Link from 'next/link';
import type { DocsClientProfile } from '@/lib/docs-client-profiles';
import { DocsSelect } from '@/components/docs/DocsUi';

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
  const options = [
    { value: '', label: 'Other / New Client (Manual)' },
    ...profiles.map((profile) => ({
      value: profile.client_id,
      label: profile.client_name,
    })),
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        <Link href="/os/clients" className="text-[11px] hover:underline" style={{ color: 'var(--accent)' }}>
          Manage OS clients
        </Link>
      </div>
      <DocsSelect value={selectedClientId} onChange={onSelectClientId} options={options} />
    </div>
  );
}

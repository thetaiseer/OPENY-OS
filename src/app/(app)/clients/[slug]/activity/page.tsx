'use client';

import { useClientWorkspace } from '../client-context';
import ActivityLog from '@/components/ui/ActivityLog';

export default function ClientActivityPage() {
  const { clientId } = useClientWorkspace();

  if (!clientId) return null;

  return (
    <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <ActivityLog clientId={clientId} limit={30} />
    </div>
  );
}

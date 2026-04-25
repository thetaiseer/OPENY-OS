'use client';

import { useClientWorkspace } from '../client-context';
import ActivityLog from '@/components/ui/ActivityLog';
import { Card, CardContent } from '@/components/ui/Card';

export default function ClientActivityPage() {
  const { clientId } = useClientWorkspace();

  if (!clientId) return null;

  return (
    <Card>
      <CardContent>
        <ActivityLog clientId={clientId} limit={30} />
      </CardContent>
    </Card>
  );
}

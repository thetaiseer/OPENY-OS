'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function ClientsPage() {
  return (
    <WorkspacePage
      title="Clients Workspace"
      subtitle="Client operations managed as reusable blocks on the canvas."
      focusBlock="clients"
      workspaceKey="clients"
    />
  );
}

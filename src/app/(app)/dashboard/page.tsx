'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function DashboardPage() {
  return (
    <WorkspacePage
      title="Workspace"
      subtitle="Unified canvas with modular operational blocks."
      focusBlock="stats"
      workspaceKey="dashboard"
    />
  );
}

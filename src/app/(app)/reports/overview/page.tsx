'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function ReportsOverviewPage() {
  return (
    <WorkspacePage
      title="Stats Workspace"
      subtitle="Operational reporting powered by modular analytics blocks."
      focusBlock="stats"
      workspaceKey="reports"
    />
  );
}

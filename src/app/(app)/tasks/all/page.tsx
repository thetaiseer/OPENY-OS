'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function TasksPage() {
  return (
    <WorkspacePage
      title="Tasks Workspace"
      subtitle="Track execution with modular task and schedule blocks."
      focusBlock="tasks"
      workspaceKey="tasks"
    />
  );
}

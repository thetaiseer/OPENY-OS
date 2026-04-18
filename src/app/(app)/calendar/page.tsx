'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function CalendarPage() {
  return (
    <WorkspacePage
      title="Calendar Workspace"
      subtitle="Time planning, due dates, and schedule blocks in one canvas."
      focusBlock="calendar"
      workspaceKey="calendar"
    />
  );
}

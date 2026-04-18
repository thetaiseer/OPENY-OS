'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function ContentPage() {
  return (
    <WorkspacePage
      title="Content Workspace"
      subtitle="Content production managed inside a structured canvas."
      focusBlock="content"
      workspaceKey="content"
    />
  );
}

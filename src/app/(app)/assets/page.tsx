'use client';

import WorkspacePage from '@/components/workspace/WorkspacePage';

export default function AssetsPage() {
  return (
    <WorkspacePage
      title="Assets Workspace"
      subtitle="Asset operations integrated as resizeable and movable blocks."
      focusBlock="assets"
      workspaceKey="assets"
    />
  );
}

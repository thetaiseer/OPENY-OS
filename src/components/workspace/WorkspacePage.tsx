'use client';

import WorkspaceCanvas, { type WorkspaceBlockId } from '@/components/workspace/WorkspaceCanvas';

export default function WorkspacePage({
  title,
  subtitle,
  focusBlock,
  workspaceKey,
}: {
  title: string;
  subtitle: string;
  focusBlock: WorkspaceBlockId;
  workspaceKey: string;
}) {
  return (
    <section className="ws-page">
      <header className="ws-page-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
      <WorkspaceCanvas workspaceKey={workspaceKey} focusBlock={focusBlock} />
    </section>
  );
}

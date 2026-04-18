import { WorkspaceShell } from '@/new-ui/workspace-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

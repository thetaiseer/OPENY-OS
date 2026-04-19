import { DocsShell } from '@/new-ui/workspace-shell';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}

import { DocsShell } from '@/new-ui/workspace-shell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}

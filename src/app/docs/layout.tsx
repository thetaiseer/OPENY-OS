import AppShellLayout from '@/components/layout/AppShellLayout';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <AppShellLayout><div className="docs-app">{children}</div></AppShellLayout>;
}

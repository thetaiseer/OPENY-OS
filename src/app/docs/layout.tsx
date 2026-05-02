import AppShellLayout from '@/components/layout/AppShellLayout';
import RoleGuard from '@/components/layout/RoleGuard';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShellLayout>
      <RoleGuard allowedRoles={['owner', 'admin', 'manager', 'team_member']}>
        <div className="docs-app">{children}</div>
      </RoleGuard>
    </AppShellLayout>
  );
}

import RoleGuard from '@/components/layout/RoleGuard';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-standalone min-h-screen bg-[var(--bg)]">
      <RoleGuard allowedRoles={['owner', 'admin', 'manager', 'team_member']}>
        <div className="docs-app h-full">{children}</div>
      </RoleGuard>
    </div>
  );
}

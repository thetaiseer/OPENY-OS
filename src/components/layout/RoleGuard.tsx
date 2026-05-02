'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import type { UserRoleKey } from '@/lib/navigation/routes';

export default function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRoleKey[];
  children: ReactNode;
}) {
  const { role, user } = useAuth();
  const router = useRouter();

  const allowed = !user || allowedRoles.includes((role ?? 'viewer') as UserRoleKey);

  useEffect(() => {
    if (user && !allowed) {
      router.replace('/access-denied?workspace=os');
    }
  }, [user, allowed, router]);

  if (!user || allowed) return <>{children}</>;
  return null;
}

'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { resolveRouteMeta } from '@/lib/navigation/routes';

type RouteTitleProps = {
  appName?: string;
};

export default function RouteTitle({ appName = 'OPENY' }: RouteTitleProps) {
  const pathname = usePathname();
  const routeMeta = resolveRouteMeta(pathname);

  useEffect(() => {
    if (!routeMeta) return;
    document.title = `${routeMeta.pageTitle} | ${appName}`;
  }, [appName, routeMeta]);

  return routeMeta ? (
    <p className="truncate text-sm font-semibold text-primary">{routeMeta.pageTitle}</p>
  ) : null;
}

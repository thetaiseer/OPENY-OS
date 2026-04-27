'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getRoutePresentation } from '@/lib/navigation/routes';

type RouteTitleProps = {
  appName?: string;
};

export default function RouteTitle({ appName = 'OPENY' }: RouteTitleProps) {
  const pathname = usePathname();
  const routePresentation = getRoutePresentation(pathname);

  useEffect(() => {
    if (!routePresentation) return;
    document.title = `${routePresentation.title} | ${appName}`;
  }, [appName, routePresentation]);

  return routePresentation ? (
    <p className="truncate text-sm font-semibold text-primary">{routePresentation.title}</p>
  ) : null;
}

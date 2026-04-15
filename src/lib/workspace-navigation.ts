export function getWorkspaceDashboardHref(pathname: string): '/docs/dashboard' | '/os/dashboard' {
  return pathname === '/docs' || pathname.startsWith('/docs/')
    ? '/docs/dashboard'
    : '/os/dashboard';
}

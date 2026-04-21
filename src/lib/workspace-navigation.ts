/**
 * Returns the active workspace key from the current pathname.
 */
export function getWorkspaceFromPathname(pathname: string): 'docs' | 'os' {
  return pathname.startsWith('/docs') ? 'docs' : 'os';
}

/**
 * Returns the correct dashboard route for the active workspace.
 */
export function getWorkspaceDashboardHref(pathname: string): '/docs' | '/os/dashboard' {
  return getWorkspaceFromPathname(pathname) === 'docs'
    ? '/docs'
    : '/os/dashboard';
}

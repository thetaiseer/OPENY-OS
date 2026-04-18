/**
 * Returns the active workspace key from the current pathname.
 */
export function getWorkspaceFromPathname(pathname: string): 'docs' | 'os' {
  return pathname.startsWith('/docs') ? 'docs' : 'os';
}

/**
 * Returns the correct dashboard route for the active workspace.
 */
export function getWorkspaceDashboardHref(pathname: string): '/docs/dashboard' | '/os/dashboard' {
  return getWorkspaceDashboardHrefByWorkspace(getWorkspaceFromPathname(pathname));
}

/**
 * Returns the correct dashboard route for a workspace key.
 */
export function getWorkspaceDashboardHrefByWorkspace(workspace: 'docs' | 'os'): '/docs/dashboard' | '/os/dashboard' {
  return workspace === 'docs' ? '/docs/dashboard' : '/os/dashboard';
}

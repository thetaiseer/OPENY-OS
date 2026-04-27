export type NavIconKey =
  | 'dashboard'
  | 'clients'
  | 'projects'
  | 'tasks'
  | 'content'
  | 'docs'
  | 'calendar'
  | 'assets'
  | 'reports'
  | 'team'
  | 'activity'
  | 'security'
  | 'settings';

export type RouteMeta = {
  key: string;
  label: string;
  href: string;
  breadcrumbLabel: string;
  pageTitle: string;
  description?: string;
  parent?: string;
  iconKey?: NavIconKey;
  sidebar?: boolean;
  aliases?: string[];
  matchPrefixes?: string[];
};

export const ROUTE_META: RouteMeta[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    breadcrumbLabel: 'Dashboard',
    pageTitle: 'Dashboard',
    iconKey: 'dashboard',
    sidebar: true,
  },
  {
    key: 'clients',
    label: 'Clients',
    href: '/clients',
    breadcrumbLabel: 'Clients',
    pageTitle: 'Clients',
    iconKey: 'clients',
    sidebar: true,
  },
  {
    key: 'client-details',
    label: 'Client details',
    href: '/clients/[id]',
    breadcrumbLabel: 'Client details',
    pageTitle: 'Client details',
    parent: 'clients',
    matchPrefixes: ['/clients/', '/clients/edit/'],
  },
  {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    breadcrumbLabel: 'Projects',
    pageTitle: 'Projects',
    iconKey: 'projects',
    sidebar: true,
  },
  {
    key: 'project-details',
    label: 'Project details',
    href: '/projects/[id]',
    breadcrumbLabel: 'Project details',
    pageTitle: 'Project details',
    parent: 'projects',
    matchPrefixes: ['/projects/'],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    href: '/tasks/all',
    breadcrumbLabel: 'Tasks',
    pageTitle: 'Tasks',
    iconKey: 'tasks',
    sidebar: true,
    aliases: ['/tasks', '/my-tasks'],
  },
  {
    key: 'content',
    label: 'Content',
    href: '/content',
    breadcrumbLabel: 'Content',
    pageTitle: 'Content',
    iconKey: 'content',
    sidebar: true,
  },
  {
    key: 'docs',
    label: 'Docs',
    href: '/docs',
    breadcrumbLabel: 'Docs',
    pageTitle: 'Docs',
    iconKey: 'docs',
    sidebar: true,
  },
  {
    key: 'docs-invoice',
    label: 'Invoice',
    href: '/docs/invoice',
    breadcrumbLabel: 'Invoice',
    pageTitle: 'Invoice',
    parent: 'docs',
    matchPrefixes: ['/docs/invoice', '/invoice'],
  },
  {
    key: 'docs-quotation',
    label: 'Quotation',
    href: '/docs/quotation',
    breadcrumbLabel: 'Quotation',
    pageTitle: 'Quotation',
    parent: 'docs',
    matchPrefixes: ['/docs/quotation', '/quotation'],
  },
  {
    key: 'docs-accounting',
    label: 'Accounting',
    href: '/docs/accounting',
    breadcrumbLabel: 'Accounting',
    pageTitle: 'Accounting',
    parent: 'docs',
    matchPrefixes: ['/docs/accounting', '/accounting'],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    href: '/calendar',
    breadcrumbLabel: 'Calendar',
    pageTitle: 'Calendar',
    iconKey: 'calendar',
    sidebar: true,
  },
  {
    key: 'assets',
    label: 'Assets',
    href: '/assets',
    breadcrumbLabel: 'Assets',
    pageTitle: 'Assets',
    iconKey: 'assets',
    sidebar: true,
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports/overview',
    breadcrumbLabel: 'Reports',
    pageTitle: 'Reports',
    iconKey: 'reports',
    sidebar: true,
    aliases: ['/reports'],
  },
  {
    key: 'team',
    label: 'Team',
    href: '/team',
    breadcrumbLabel: 'Team',
    pageTitle: 'Team',
    iconKey: 'team',
    sidebar: true,
  },
  {
    key: 'activity',
    label: 'Activity',
    href: '/activity',
    breadcrumbLabel: 'Activity',
    pageTitle: 'Activity',
    iconKey: 'activity',
    sidebar: true,
  },
  {
    key: 'security',
    label: 'Security',
    href: '/security/sessions',
    breadcrumbLabel: 'Security',
    pageTitle: 'Security',
    iconKey: 'security',
    sidebar: true,
    aliases: ['/security'],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings/profile',
    breadcrumbLabel: 'Settings',
    pageTitle: 'Settings',
    iconKey: 'settings',
    sidebar: true,
    aliases: ['/settings'],
  },
];

export type BreadcrumbItem = {
  key: string;
  label: string;
  href: string;
  isCurrent: boolean;
};

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

function candidates(meta: RouteMeta): string[] {
  const values = [meta.href, ...(meta.aliases ?? []), ...(meta.matchPrefixes ?? [])];
  return [...new Set(values.map((value) => normalizePath(value)))];
}

function scoreMatch(pathname: string, candidate: string): number {
  if (pathname === candidate) return candidate.length + 1000;
  if (pathname.startsWith(`${candidate}/`)) return candidate.length;
  if (candidate.endsWith('/') && pathname.startsWith(candidate)) return candidate.length - 1;
  return -1;
}

export function resolveRouteMeta(pathnameRaw: string): RouteMeta | null {
  const pathname = normalizePath(pathnameRaw);
  let best: { meta: RouteMeta; score: number } | null = null;

  for (const meta of ROUTE_META) {
    for (const candidate of candidates(meta)) {
      const score = scoreMatch(pathname, candidate);
      if (score < 0) continue;
      if (!best || score > best.score) {
        best = { meta, score };
      }
    }
  }

  return best?.meta ?? null;
}

export function getSidebarRoutes(): RouteMeta[] {
  return ROUTE_META.filter((meta) => meta.sidebar);
}

export function buildBreadcrumbs(pathnameRaw: string): BreadcrumbItem[] {
  const pathname = normalizePath(pathnameRaw);
  const current = resolveRouteMeta(pathname);
  if (!current) return [];

  const byKey = new Map(ROUTE_META.map((meta) => [meta.key, meta]));
  const chain: RouteMeta[] = [];
  const guard = new Set<string>();
  let cursor: RouteMeta | undefined = current;

  while (cursor && !guard.has(cursor.key)) {
    chain.unshift(cursor);
    guard.add(cursor.key);
    cursor = cursor.parent ? byKey.get(cursor.parent) : undefined;
  }

  return chain.map((meta, index) => ({
    key: meta.key,
    label: meta.breadcrumbLabel,
    href: meta.href,
    isCurrent: index === chain.length - 1,
  }));
}

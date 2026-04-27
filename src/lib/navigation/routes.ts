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

export type NavSectionKey = 'core' | 'work' | 'business' | 'system';

export type RouteMeta = {
  key: string;
  label: string;
  href: string;
  title: string;
  breadcrumbLabel?: string;
  description: string;
  parent?: string;
  iconKey?: NavIconKey;
  sidebar?: boolean;
  aliases?: string[];
  matchPrefixes?: string[];
  section?: NavSectionKey;
};

export const ROUTE_META: RouteMeta[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    title: 'Dashboard',
    description: 'Overview of performance, tasks, and workspace activity.',
    iconKey: 'dashboard',
    sidebar: true,
    section: 'core',
  },
  {
    key: 'clients',
    label: 'Clients',
    href: '/clients',
    title: 'Clients',
    description: 'Manage client accounts and related workstreams.',
    iconKey: 'clients',
    sidebar: true,
    section: 'core',
  },
  {
    key: 'client-details',
    label: 'Client details',
    href: '/clients/[id]',
    title: 'Client details',
    description: 'View client profile, projects, tasks, and assets.',
    parent: 'clients',
    matchPrefixes: ['/clients/', '/clients/edit/'],
  },
  {
    key: 'projects',
    label: 'Projects',
    href: '/projects',
    title: 'Projects',
    description: 'Track project progress and delivery status.',
    iconKey: 'projects',
    sidebar: true,
    section: 'core',
  },
  {
    key: 'project-details',
    label: 'Project details',
    href: '/projects/[id]',
    title: 'Project details',
    description: 'View project timeline, scope, and linked tasks.',
    parent: 'projects',
    matchPrefixes: ['/projects/'],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    href: '/tasks/all',
    title: 'Tasks',
    description: 'Manage personal and team task execution.',
    iconKey: 'tasks',
    sidebar: true,
    aliases: ['/tasks', '/my-tasks'],
    section: 'core',
  },
  {
    key: 'content',
    label: 'Content',
    href: '/content',
    title: 'Content',
    description: 'Plan, organize, and publish content assets.',
    iconKey: 'content',
    sidebar: true,
    section: 'work',
  },
  {
    key: 'docs',
    label: 'Docs',
    href: '/docs',
    title: 'Docs',
    description: 'Create and manage operational business documents.',
    iconKey: 'docs',
    sidebar: true,
    section: 'business',
  },
  {
    key: 'docs-invoice',
    label: 'Invoice',
    href: '/docs/invoice',
    title: 'Invoice',
    description: 'Create and manage invoices.',
    parent: 'docs',
    matchPrefixes: ['/docs/invoice', '/invoice'],
  },
  {
    key: 'docs-quotation',
    label: 'Quotation',
    href: '/docs/quotation',
    title: 'Quotation',
    description: 'Create and manage quotations.',
    parent: 'docs',
    matchPrefixes: ['/docs/quotation', '/quotation'],
  },
  {
    key: 'docs-accounting',
    label: 'Accounting',
    href: '/docs/accounting',
    title: 'Accounting',
    description: 'Track expenses, transfers, and financial entries.',
    parent: 'docs',
    matchPrefixes: ['/docs/accounting', '/accounting'],
  },
  {
    key: 'calendar',
    label: 'Calendar',
    href: '/calendar',
    title: 'Calendar',
    description: 'View schedule, deadlines, and publishing timeline.',
    iconKey: 'calendar',
    sidebar: true,
    section: 'work',
  },
  {
    key: 'assets',
    label: 'Assets',
    href: '/assets',
    title: 'Assets',
    description: 'Store, organize, and retrieve workspace files.',
    iconKey: 'assets',
    sidebar: true,
    section: 'work',
  },
  {
    key: 'reports',
    label: 'Reports',
    href: '/reports/overview',
    title: 'Reports',
    description: 'Analyze outcomes and operational performance.',
    iconKey: 'reports',
    sidebar: true,
    aliases: ['/reports'],
    section: 'business',
  },
  {
    key: 'team',
    label: 'Team',
    href: '/team',
    title: 'Team',
    description: 'Manage team members, access, and invitations.',
    iconKey: 'team',
    sidebar: true,
    section: 'system',
  },
  {
    key: 'activity',
    label: 'Activity',
    href: '/activity',
    title: 'Activity',
    description: 'Review recent workspace actions and events.',
    iconKey: 'activity',
    sidebar: true,
    section: 'system',
  },
  {
    key: 'security',
    label: 'Security',
    href: '/security/sessions',
    title: 'Security',
    description: 'Manage sessions and account security controls.',
    iconKey: 'security',
    sidebar: true,
    aliases: ['/security'],
    section: 'system',
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings/profile',
    title: 'Settings',
    description: 'Configure profile and workspace preferences.',
    iconKey: 'settings',
    sidebar: true,
    aliases: ['/settings'],
    section: 'system',
  },
];

export type BreadcrumbItem = {
  key: string;
  label: string;
  href: string;
  isCurrent: boolean;
};

export type RoutePresentation = {
  title: string;
  description: string;
  breadcrumbLabel: string;
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

export function getRoutePresentation(pathnameRaw: string): RoutePresentation | null {
  const meta = resolveRouteMeta(pathnameRaw);
  if (!meta) return null;
  return {
    title: meta.title,
    description: meta.description,
    breadcrumbLabel: meta.breadcrumbLabel ?? meta.label,
  };
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
    label: meta.breadcrumbLabel ?? meta.label,
    href: meta.href,
    isCurrent: index === chain.length - 1,
  }));
}

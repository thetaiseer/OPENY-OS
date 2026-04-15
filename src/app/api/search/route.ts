/**
 * GET /api/search?q=<query>&limit=<n>
 *
 * Global search across clients, tasks, assets, content_items, team_members.
 * Returns grouped results for the command palette and global search UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_GROUP = 5;

export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 10);

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [], query: q });
  }

  const db = getServiceClient();
  const pattern = `%${q}%`;

  const [clients, tasks, assets, content, team] = await Promise.all([
    // Clients
    db
      .from('clients')
      .select('id, name, email, status, slug')
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),

    // Tasks
    db
      .from('tasks')
      .select('id, title, status, priority, due_date, client:clients(id,name)')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(limit),

    // Assets
    db
      .from('assets')
      .select('id, name, content_type, client_name, file_type')
      .or(`name.ilike.${pattern},client_name.ilike.${pattern}`)
      .is('is_deleted', false)
      .limit(limit),

    // Content items
    db
      .from('content_items')
      .select('id, title, status, client:clients(id,name)')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(limit),

    // Team members
    db
      .from('team_members')
      .select('id, full_name, email, role, status')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),
  ]);

  interface SearchResult {
    id: string;
    type: 'client' | 'task' | 'asset' | 'content' | 'team';
    title: string;
    subtitle?: string;
    badge?: string;
    href: string;
  }

  const results: SearchResult[] = [];

  if (clients.data?.length) {
    for (const c of clients.data.slice(0, MAX_PER_GROUP)) {
      results.push({
        id: c.id,
        type: 'client',
        title: c.name,
        subtitle: c.email || undefined,
        badge: c.status,
        href: `/os/clients/${c.slug}`,
      });
    }
  }

  if (tasks.data?.length) {
    for (const t of tasks.data.slice(0, MAX_PER_GROUP)) {
      const client = Array.isArray(t.client) ? t.client[0] : t.client;
      results.push({
        id: t.id,
        type: 'task',
        title: t.title,
        subtitle: client?.name,
        badge: t.status,
        href: `/os/tasks`,
      });
    }
  }

  if (assets.data?.length) {
    for (const a of assets.data.slice(0, MAX_PER_GROUP)) {
      results.push({
        id: a.id,
        type: 'asset',
        title: a.name,
        subtitle: a.client_name || a.content_type || undefined,
        badge: a.file_type || undefined,
        href: `/os/assets`,
      });
    }
  }

  if (content.data?.length) {
    for (const ci of content.data.slice(0, MAX_PER_GROUP)) {
      const client = Array.isArray(ci.client) ? ci.client[0] : ci.client;
      results.push({
        id: ci.id,
        type: 'content',
        title: ci.title,
        subtitle: client?.name,
        badge: ci.status,
        href: `/os/content`,
      });
    }
  }

  if (team.data?.length) {
    for (const m of team.data.slice(0, MAX_PER_GROUP)) {
      results.push({
        id: m.id,
        type: 'team',
        title: m.full_name,
        subtitle: m.email,
        badge: m.role || undefined,
        href: `/os/team`,
      });
    }
  }

  return NextResponse.json({ results, query: q });
}

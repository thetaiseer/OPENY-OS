/**
 * GET /api/search?q=<query>&limit=<n>
 *
 * Global search across clients, tasks, assets, content_items, team_members
 * (OPENY OS) and invoices, quotations, employees (OPENY DOCS) based on the
 * caller's workspace memberships.
 * Returns grouped results for the command palette and global search UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { isGlobalOwnerEmail } from '@/lib/workspace-access';

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

  // Determine if the caller has docs workspace access.
  const hasDocsAccess = isGlobalOwnerEmail(auth.profile.email)
    ? true
    : await (async () => {
        const { data } = await db
          .from('workspace_memberships')
          .select('id')
          .eq('user_id', auth.profile.id)
          .eq('workspace_key', 'docs')
          .eq('is_active', true)
          .maybeSingle();
        return Boolean(data);
      })();

  interface SearchResult {
    id: string;
    type: 'client' | 'task' | 'asset' | 'content' | 'team' | 'invoice' | 'quotation' | 'employee';
    title: string;
    subtitle?: string;
    badge?: string;
    href: string;
  }

  // ── OS entity queries ──────────────────────────────────────────────────────
  const [clients, tasks, assets, content, team] = await Promise.all([
    db
      .from('clients')
      .select('id, name, email, status, slug')
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),

    db
      .from('tasks')
      .select('id, title, status, priority, due_date, client:clients(id,name)')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(limit),

    db
      .from('assets')
      .select('id, name, content_type, client_name, file_type')
      .or(`name.ilike.${pattern},client_name.ilike.${pattern}`)
      .is('is_deleted', false)
      .limit(limit),

    db
      .from('content_items')
      .select('id, title, status, client:clients(id,name)')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(limit),

    db
      .from('team_members')
      .select('id, full_name, email, role, status')
      .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(limit),
  ]);

  // ── DOCS entity queries (only when user has docs access) ───────────────────
  const [invoices, quotations, employees] = hasDocsAccess
    ? await Promise.all([
        db
          .from('docs_invoices')
          .select('id, invoice_number, client_name, status, invoice_date')
          .or(`invoice_number.ilike.${pattern},client_name.ilike.${pattern}`)
          .limit(limit),

        db
          .from('docs_quotations')
          .select('id, quote_number, client_name, status, quote_date')
          .or(`quote_number.ilike.${pattern},client_name.ilike.${pattern}`)
          .limit(limit),

        db
          .from('docs_employees')
          .select('id, full_name, job_title, status, employee_id')
          .or(`full_name.ilike.${pattern},job_title.ilike.${pattern},employee_id.ilike.${pattern}`)
          .limit(limit),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const results: SearchResult[] = [];

  // ── Map OS results ─────────────────────────────────────────────────────────
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
        subtitle: (client as { name?: string } | null)?.name,
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
        subtitle: (client as { name?: string } | null)?.name,
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

  // ── Map DOCS results ───────────────────────────────────────────────────────
  if (invoices.data?.length) {
    for (const inv of (invoices.data as Array<{ id: string; invoice_number: string; client_name: string; status: string; invoice_date: string | null }>).slice(0, MAX_PER_GROUP)) {
      results.push({
        id: inv.id,
        type: 'invoice',
        title: `Invoice ${inv.invoice_number}`,
        subtitle: inv.client_name || undefined,
        badge: inv.status,
        href: `/docs/invoice`,
      });
    }
  }

  if (quotations.data?.length) {
    for (const qt of (quotations.data as Array<{ id: string; quote_number: string; client_name: string; status: string; quote_date: string | null }>).slice(0, MAX_PER_GROUP)) {
      results.push({
        id: qt.id,
        type: 'quotation',
        title: `Quotation ${qt.quote_number}`,
        subtitle: qt.client_name || undefined,
        badge: qt.status,
        href: `/docs/quotation`,
      });
    }
  }

  if (employees.data?.length) {
    for (const emp of (employees.data as Array<{ id: string; full_name: string; job_title: string | null; status: string; employee_id: string }>).slice(0, MAX_PER_GROUP)) {
      results.push({
        id: emp.id,
        type: 'employee',
        title: emp.full_name,
        subtitle: emp.job_title || undefined,
        badge: emp.status,
        href: `/docs/employees`,
      });
    }
  }

  return NextResponse.json({ results, query: q });
}


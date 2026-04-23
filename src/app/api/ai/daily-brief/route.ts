import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { getServiceClient } from '@/lib/supabase/service-client';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/daily-brief
 *
 * Generates an operational daily summary for the current user covering:
 * - Tasks due today
 * - Overdue tasks
 * - Recent asset uploads
 * - Active client count
 * - Suggested next actions
 *
 * Request body (optional JSON):
 *   { section?: string; clientContext?: { name?: string; id?: string } }
 *
 * Response:
 *   { success: true, brief: string, data: { stats } }
 *   { success: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'owner']);
    if (auth instanceof NextResponse) return auth;

    const rl = checkRateLimit(`ai:user:${auth.profile.id}`, { limit: 20, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many AI requests. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    const sb = getServiceClient();
    const today = new Date().toISOString().split('T')[0];
    const userId = auth.profile.id;
    const userRole = auth.profile.role as string;

    // ── Gather workspace data ──────────────────────────────────────────────────

    // Tasks due today (scoped to user for non-admin)
    let dueTodayQuery = sb
      .from('tasks')
      .select('id, title, status, priority, client_id')
      .eq('due_date', today)
      .not('status', 'in', '("completed","cancelled","published")')
      .order('priority', { ascending: false })
      .limit(20);

    if (userRole === 'team_member') {
      dueTodayQuery = dueTodayQuery.eq('assignee_id', userId);
    }

    // Overdue tasks
    let overdueQuery = sb
      .from('tasks')
      .select('id, title, status, priority, due_date, client_id')
      .lt('due_date', today)
      .not('status', 'in', '("completed","cancelled","published")')
      .order('due_date', { ascending: true })
      .limit(20);

    if (userRole === 'team_member') {
      overdueQuery = overdueQuery.eq('assignee_id', userId);
    }

    // Active clients count
    const activeClientsQuery = sb
      .from('clients')
      .select('id, name', { count: 'exact', head: true })
      .eq('status', 'active');

    // Recent uploads (last 24h)
    const recentUploadsQuery = sb
      .from('assets')
      .select('id, name, client_id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());

    // Pending content (draft/scheduled)
    const pendingContentQuery = sb
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'scheduled', 'in_review']);

    const [dueToday, overdue, activeClients, recentUploads, pendingContent] = await Promise.all([
      dueTodayQuery,
      overdueQuery,
      activeClientsQuery,
      recentUploadsQuery,
      pendingContentQuery,
    ]);

    // ── Build summary for AI ───────────────────────────────────────────────────

    const stats = {
      tasksDueToday: dueToday.data?.length ?? 0,
      overdueTasks: overdue.data?.length ?? 0,
      activeClients: activeClients.count ?? 0,
      recentUploads: recentUploads.count ?? 0,
      pendingContent: pendingContent.count ?? 0,
    };

    const dueTodayList = (dueToday.data ?? [])
      .slice(0, 5)
      .map(
        (t: {
          title: string;
          priority: string;
          id: string;
          status: string;
          client_id: string | null;
        }) => `• ${t.title} [${t.priority}]`,
      )
      .join('\n');

    const overdueList = (overdue.data ?? [])
      .slice(0, 5)
      .map(
        (t: {
          title: string;
          due_date: string;
          id: string;
          status: string;
          priority: string;
          client_id: string | null;
        }) => `• ${t.title} (due: ${t.due_date})`,
      )
      .join('\n');

    const dataBlock = [
      `Date: ${today}`,
      `Tasks due today: ${stats.tasksDueToday}`,
      dueTodayList ? `Top tasks:\n${dueTodayList}` : '',
      `Overdue tasks: ${stats.overdueTasks}`,
      overdueList ? `Overdue:\n${overdueList}` : '',
      `Active clients: ${stats.activeClients}`,
      `Assets uploaded in last 24h: ${stats.recentUploads}`,
      `Pending content items: ${stats.pendingContent}`,
    ]
      .filter(Boolean)
      .join('\n');

    // ── Generate AI brief ──────────────────────────────────────────────────────

    try {
      const brief = await callAI({
        system:
          'You are an operational assistant for a creative agency. Generate a concise, actionable daily brief ' +
          'for the team. Use a professional but friendly tone. Include: a one-line summary, what needs immediate attention, ' +
          'and 2-3 suggested next actions. Use short bullet points. Keep it under 150 words.',
        user: dataBlock,
        maxTokens: 400,
        temperature: 0.5,
      });

      return NextResponse.json({
        success: true,
        brief,
        data: { stats },
        actions_taken: ['Generated daily brief'],
      });
    } catch (aiErr) {
      if (aiErr instanceof AiUnconfiguredError) {
        // Return a plain-text brief without AI
        const fallback =
          `**Daily Brief — ${today}**\n\n` +
          `• ${stats.tasksDueToday} task(s) due today\n` +
          `• ${stats.overdueTasks} overdue task(s) need attention\n` +
          `• ${stats.activeClients} active clients\n` +
          `• ${stats.recentUploads} new file(s) uploaded in the last 24h\n` +
          `• ${stats.pendingContent} content item(s) pending\n\n` +
          (stats.overdueTasks > 0
            ? '⚠️ Focus on clearing overdue tasks first.\n'
            : '✅ No overdue tasks — great work!\n');

        return NextResponse.json({
          success: true,
          brief: fallback,
          data: { stats },
          actions_taken: ['Generated daily brief (AI not configured)'],
        });
      }
      throw aiErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai/daily-brief] error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

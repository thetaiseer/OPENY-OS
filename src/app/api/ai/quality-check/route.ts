import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { getServiceClient } from '@/lib/supabase/service-client';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/quality-check
 *
 * Scans the workspace for data quality issues:
 * - Tasks without assignee
 * - Tasks without due date
 * - Tasks without client
 * - Assets without client link
 * - Content items without schedule
 * - Overdue tasks
 *
 * Returns a list of issues and an AI-generated cleanup summary.
 *
 * Request body (optional JSON):
 *   { section?: string; clientContext?: { id?: string; name?: string } }
 *
 * Response:
 *   { success: true, summary: string, issues: string[], data: { counts } }
 *   { success: false, error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'owner']);
    if (auth instanceof NextResponse) return auth;

    const rl = checkRateLimit(`ai:user:${auth.profile.id}`, { limit: 15, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many AI requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const clientId = (body.clientContext as Record<string, string> | undefined)?.id ?? null;
    const sb = getServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // ── Run all quality checks in parallel ─────────────────────────────────────

    const [
      noAssignee,
      noDueDate,
      noClient,
      overdueTasks,
      unclassifiedAssets,
      contentNoPlatform,
      contentNoSchedule,
    ] = await Promise.all([
      // Tasks without assignee
      (clientId
        ? sb.from('tasks').select('id', { count: 'exact', head: true })
            .is('assignee_id', null)
            .not('status', 'in', '("completed","cancelled","published")')
            .eq('client_id', clientId)
        : sb.from('tasks').select('id', { count: 'exact', head: true })
            .is('assignee_id', null)
            .not('status', 'in', '("completed","cancelled","published")')
      ),

      // Tasks without due date
      (clientId
        ? sb.from('tasks').select('id', { count: 'exact', head: true })
            .is('due_date', null)
            .not('status', 'in', '("completed","cancelled","published")')
            .eq('client_id', clientId)
        : sb.from('tasks').select('id', { count: 'exact', head: true })
            .is('due_date', null)
            .not('status', 'in', '("completed","cancelled","published")')
      ),

      // Tasks without client link
      (clientId
        ? Promise.resolve({ count: 0 })
        : sb.from('tasks').select('id', { count: 'exact', head: true })
            .is('client_id', null)
            .not('status', 'in', '("completed","cancelled","published")')
      ),

      // Overdue tasks
      (clientId
        ? sb.from('tasks').select('id', { count: 'exact', head: true })
            .lt('due_date', today)
            .not('status', 'in', '("completed","cancelled","published")')
            .eq('client_id', clientId)
        : sb.from('tasks').select('id', { count: 'exact', head: true })
            .lt('due_date', today)
            .not('status', 'in', '("completed","cancelled","published")')
      ),

      // Assets without client (only workspace-level check)
      (!clientId
        ? sb.from('assets').select('id', { count: 'exact', head: true }).is('client_id', null)
        : Promise.resolve({ count: 0 })
      ),

      // Content items without platform set (post_type is null or empty)
      (clientId
        ? sb.from('content_items').select('id', { count: 'exact', head: true })
            .is('post_type', null)
            .not('status', 'in', '("published","cancelled")')
            .eq('client_id', clientId)
        : sb.from('content_items').select('id', { count: 'exact', head: true })
            .is('post_type', null)
            .not('status', 'in', '("published","cancelled")')
      ),

      // Content items without publishing schedule
      (clientId
        ? sb.from('content_items').select('id', { count: 'exact', head: true })
            .eq('status', 'draft')
            .eq('client_id', clientId)
        : sb.from('content_items').select('id', { count: 'exact', head: true })
            .eq('status', 'draft')
      ),
    ]);

    // ── Build issues list ─────────────────────────────────────────────────────

    const counts = {
      tasksWithoutAssignee: noAssignee.count ?? 0,
      tasksWithoutDueDate:  noDueDate.count ?? 0,
      tasksWithoutClient:   noClient.count ?? 0,
      overdueTasks:         overdueTasks.count ?? 0,
      assetsWithoutClient:  unclassifiedAssets.count ?? 0,
      contentNoPlatform:    contentNoPlatform.count ?? 0,
      contentDraftUnscheduled: contentNoSchedule.count ?? 0,
    };

    const issues: string[] = [];

    if (counts.overdueTasks > 0)
      issues.push(`${counts.overdueTasks} overdue task(s) — need immediate attention`);
    if (counts.tasksWithoutAssignee > 0)
      issues.push(`${counts.tasksWithoutAssignee} task(s) have no assignee`);
    if (counts.tasksWithoutDueDate > 0)
      issues.push(`${counts.tasksWithoutDueDate} task(s) have no due date`);
    if (counts.tasksWithoutClient > 0)
      issues.push(`${counts.tasksWithoutClient} task(s) are not linked to any client`);
    if (counts.assetsWithoutClient > 0)
      issues.push(`${counts.assetsWithoutClient} asset(s) are not linked to any client`);
    if (counts.contentNoPlatform > 0)
      issues.push(`${counts.contentNoPlatform} content item(s) have no platform type set`);
    if (counts.contentDraftUnscheduled > 0)
      issues.push(`${counts.contentDraftUnscheduled} content item(s) are still in draft without a schedule`);

    const totalIssues = issues.length;

    if (totalIssues === 0) {
      return NextResponse.json({
        success: true,
        summary: '✅ Your workspace looks clean! No data quality issues detected.',
        issues: [],
        data: { counts },
        actions_taken: ['Ran quality check — no issues found'],
      });
    }

    // ── AI summary ───────────────────────────────────────────────────────────

    try {
      const issueBlock = issues.map((i, n) => `${n + 1}. ${i}`).join('\n');

      const summary = await callAI({
        system:
          'You are a workspace quality manager. Summarize the following data issues in 2-3 sentences. ' +
          'Be direct and actionable. Suggest which to fix first. Keep it under 80 words.',
        user: issueBlock,
        maxTokens: 200,
        temperature: 0.4,
      });

      return NextResponse.json({
        success: true,
        summary,
        issues,
        data: { counts },
        actions_taken: [`Quality check complete — found ${totalIssues} issue(s)`],
      });

    } catch (aiErr) {
      if (aiErr instanceof AiUnconfiguredError) {
        const fallback =
          `Found ${totalIssues} data quality issue(s). ` +
          (counts.overdueTasks > 0
            ? `Start by clearing ${counts.overdueTasks} overdue task(s). `
            : '') +
          (counts.tasksWithoutAssignee > 0
            ? `Then assign owners to ${counts.tasksWithoutAssignee} unassigned task(s). `
            : '');

        return NextResponse.json({
          success: true,
          summary: fallback,
          issues,
          data: { counts },
          actions_taken: [`Quality check complete — found ${totalIssues} issue(s)`],
        });
      }
      throw aiErr;
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai/quality-check] error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

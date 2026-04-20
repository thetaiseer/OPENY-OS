import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { notifyCommentAdded } from '@/lib/notification-service';

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  const taskId = typeof body?.task_id === 'string' ? body.task_id : null;
  const assetId = typeof body?.asset_id === 'string' ? body.asset_id : null;
  const mentions = Array.isArray(body?.mentions)
    ? body?.mentions.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];

  if (!content) {
    return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
  }
  if (!taskId && !assetId) {
    return NextResponse.json({ success: false, error: 'task_id or asset_id is required' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data: inserted, error } = await db
    .from('comments')
    .insert({
      content,
      user_id: auth.profile.id,
      user_name: auth.profile.name,
      ...(taskId ? { task_id: taskId } : {}),
      ...(assetId ? { asset_id: assetId } : {}),
      ...(mentions.length ? { mentions } : {}),
    })
    .select()
    .single();

  if (error || !inserted) {
    return NextResponse.json({ success: false, error: error?.message ?? 'Failed to create comment' }, { status: 500 });
  }

  void (async () => {
    const watcherIds = new Set<string>();
    for (const id of mentions) watcherIds.add(id);

    if (taskId) {
      const { data: task } = await db
        .from('tasks')
        .select('assigned_to, created_by_id')
        .eq('id', taskId)
        .maybeSingle();
      if (task?.assigned_to) watcherIds.add(task.assigned_to as string);
      if (task?.created_by_id) watcherIds.add(task.created_by_id as string);
    }

    let commentsQuery = db.from('comments').select('user_id').limit(100);
    if (taskId) commentsQuery = commentsQuery.eq('task_id', taskId);
    if (assetId) commentsQuery = commentsQuery.eq('asset_id', assetId);
    const { data: relatedComments } = await commentsQuery;
    for (const row of relatedComments ?? []) {
      const uid = (row as { user_id?: string | null }).user_id;
      if (uid) watcherIds.add(uid);
    }

    watcherIds.delete(auth.profile.id);
    await notifyCommentAdded({
      commentId: inserted.id as string,
      content,
      actorId: auth.profile.id,
      actorName: auth.profile.name,
      taskId,
      assetId,
      watcherUserIds: [...watcherIds],
    });
  })();

  return NextResponse.json({ success: true, comment: inserted }, { status: 201 });
}

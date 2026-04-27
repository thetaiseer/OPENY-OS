import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONTENT_ITEM_WITH_CLIENT,
  CONTENT_ITEM_WITH_CLIENT_FALLBACK,
} from '@/lib/supabase-list-columns';

type DbError = { code?: string; message?: string } | null;

function isPlatformTargetsMissing(error: DbError): boolean {
  if (!error) return false;
  const message = String(error.message ?? '').toLowerCase();
  return error.code === '42703' && message.includes('platform_targets');
}

export function sanitizeContentItemsApiError(error: DbError): string {
  if (isPlatformTargetsMissing(error)) {
    return 'Content data is temporarily unavailable. Please sync database migrations and retry.';
  }
  return 'Failed to load content items.';
}

export async function selectContentItemsWithClientFallback(params: {
  db: SupabaseClient;
  workspaceId: string;
  clientId?: string | null;
  status?: string | null;
  platform?: string | null;
}) {
  const { db, workspaceId, clientId, status, platform } = params;

  let query = db
    .from('content_items')
    .select(CONTENT_ITEM_WITH_CLIENT)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (clientId) query = query.eq('client_id', clientId);
  if (status) query = query.eq('status', status);
  if (platform) {
    query = (
      query as unknown as { contains: (column: string, values: string[]) => typeof query }
    ).contains('platform_targets', [platform]);
  }

  const first = await query;
  if (!isPlatformTargetsMissing(first.error)) return first;

  let fallbackQuery = db
    .from('content_items')
    .select(CONTENT_ITEM_WITH_CLIENT_FALLBACK)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (clientId) fallbackQuery = fallbackQuery.eq('client_id', clientId);
  if (status) fallbackQuery = fallbackQuery.eq('status', status);
  // `platform_targets` is unavailable, so we intentionally skip platform filter in fallback mode.

  const fallback = await fallbackQuery;
  return {
    data: (fallback.data ?? []).map((row) => ({
      ...row,
      platform_targets: [],
    })),
    error: fallback.error,
  };
}

export async function insertContentItemWithClientFallback(params: {
  db: SupabaseClient;
  payload: Record<string, unknown>;
}) {
  const first = await params.db
    .from('content_items')
    .insert(params.payload)
    .select(CONTENT_ITEM_WITH_CLIENT)
    .single();

  if (!isPlatformTargetsMissing(first.error)) return first;

  const fallbackPayload = { ...params.payload };
  delete fallbackPayload.platform_targets;

  const fallback = await params.db
    .from('content_items')
    .insert(fallbackPayload)
    .select(CONTENT_ITEM_WITH_CLIENT_FALLBACK)
    .single();

  return {
    data: fallback.data ? { ...fallback.data, platform_targets: [] } : fallback.data,
    error: fallback.error,
  };
}

export async function updateContentItemWithClientFallback(params: {
  db: SupabaseClient;
  id: string;
  updates: Record<string, unknown>;
}) {
  const first = await params.db
    .from('content_items')
    .update(params.updates)
    .eq('id', params.id)
    .select(CONTENT_ITEM_WITH_CLIENT)
    .single();

  if (!isPlatformTargetsMissing(first.error)) return first;

  const fallbackUpdates = { ...params.updates };
  delete fallbackUpdates.platform_targets;

  const fallback = await params.db
    .from('content_items')
    .update(fallbackUpdates)
    .eq('id', params.id)
    .select(CONTENT_ITEM_WITH_CLIENT_FALLBACK)
    .single();

  return {
    data: fallback.data ? { ...fallback.data, platform_targets: [] } : fallback.data,
    error: fallback.error,
  };
}

export async function selectSingleContentItemWithClientFallback(params: {
  db: SupabaseClient;
  id: string;
  workspaceId?: string | null;
}) {
  let query = params.db.from('content_items').select(CONTENT_ITEM_WITH_CLIENT).eq('id', params.id);
  if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);
  const first = await query.single();
  if (!isPlatformTargetsMissing(first.error)) return first;

  let fallbackQuery = params.db
    .from('content_items')
    .select(CONTENT_ITEM_WITH_CLIENT_FALLBACK)
    .eq('id', params.id);
  if (params.workspaceId) fallbackQuery = fallbackQuery.eq('workspace_id', params.workspaceId);
  const fallback = await fallbackQuery.single();
  return {
    data: fallback.data ? { ...fallback.data, platform_targets: [] } : fallback.data,
    error: fallback.error,
  };
}

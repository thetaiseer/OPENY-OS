import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceKey, WorkspaceRole } from '@/lib/workspace-access';

export type WorkspaceMembershipUpsertPayload = {
  user_id: string;
  workspace_key: WorkspaceKey;
  workspace_id?: string | null;
  role: WorkspaceRole;
  is_active: boolean;
  updated_at?: string;
};

type UpsertResult =
  | { ok: true; usedFallback: boolean; upserted: number }
  | { ok: false; usedFallback: boolean; error: string };

function shouldUseConflictFallback(message: string, code?: string): boolean {
  if (code === '42P10') return true;
  if (code === '23505') return true;
  if (/duplicate key value violates unique constraint/i.test(message)) return true;
  return /no unique or exclusion constraint matching the on conflict specification/i.test(message);
}

export async function upsertWorkspaceMembershipsWithFallback(
  db: SupabaseClient,
  memberships: WorkspaceMembershipUpsertPayload[],
  context: string,
): Promise<UpsertResult> {
  if (memberships.length === 0) {
    return { ok: true, usedFallback: false, upserted: 0 };
  }

  const { error: upsertError } = await db
    .from('workspace_memberships')
    .upsert(memberships, { onConflict: 'user_id,workspace_key' });

  if (!upsertError) {
    return { ok: true, usedFallback: false, upserted: memberships.length };
  }

  const message = upsertError.message ?? 'Failed to upsert workspace memberships';
  if (!shouldUseConflictFallback(message, upsertError.code)) {
    return { ok: false, usedFallback: false, error: message };
  }

  console.warn(`[${context}] Falling back to update/insert workspace membership flow:`, message);

  for (const membership of memberships) {
    const nowIso = membership.updated_at ?? new Date().toISOString();
    let existingId: string | null = null;

    if (membership.workspace_id) {
      const byWorkspaceId = await db
        .from('workspace_memberships')
        .select('id')
        .eq('user_id', membership.user_id)
        .eq('workspace_id', membership.workspace_id)
        .maybeSingle();
      if (!byWorkspaceId.error && byWorkspaceId.data?.id) {
        existingId = String(byWorkspaceId.data.id);
      } else if (byWorkspaceId.error && !/workspace_id/i.test(byWorkspaceId.error.message ?? '')) {
        return { ok: false, usedFallback: true, error: byWorkspaceId.error.message };
      }
    }

    if (!existingId) {
      const byWorkspaceKey = await db
        .from('workspace_memberships')
        .select('id')
        .eq('user_id', membership.user_id)
        .eq('workspace_key', membership.workspace_key)
        .maybeSingle();
      if (!byWorkspaceKey.error && byWorkspaceKey.data?.id) {
        existingId = String(byWorkspaceKey.data.id);
      } else if (
        byWorkspaceKey.error &&
        !/workspace_key/i.test(byWorkspaceKey.error.message ?? '')
      ) {
        return { ok: false, usedFallback: true, error: byWorkspaceKey.error.message };
      }
    }

    if (existingId) {
      const { error: updateError } = await db
        .from('workspace_memberships')
        .update({
          role: membership.role,
          is_active: membership.is_active,
          updated_at: nowIso,
          ...(membership.workspace_id ? { workspace_id: membership.workspace_id } : {}),
        })
        .eq('id', existingId);

      if (updateError) {
        return { ok: false, usedFallback: true, error: updateError.message };
      }
      continue;
    }

    const insertWithWorkspaceId = async () =>
      db.from('workspace_memberships').insert({
        user_id: membership.user_id,
        workspace_key: membership.workspace_key,
        workspace_id: membership.workspace_id,
        role: membership.role,
        is_active: membership.is_active,
        updated_at: nowIso,
      });
    const insertWithoutWorkspaceId = async () =>
      db.from('workspace_memberships').insert({
        user_id: membership.user_id,
        workspace_key: membership.workspace_key,
        role: membership.role,
        is_active: membership.is_active,
        updated_at: nowIso,
      });

    const insertResult = membership.workspace_id
      ? await insertWithWorkspaceId()
      : await insertWithoutWorkspaceId();
    let insertError = insertResult.error;

    if (insertError && /workspace_id/i.test(insertError.message ?? '')) {
      const fallbackInsert = await insertWithoutWorkspaceId();
      insertError = fallbackInsert.error;
    }

    if (insertError) {
      return { ok: false, usedFallback: true, error: insertError.message };
    }
  }

  return { ok: true, usedFallback: true, upserted: memberships.length };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceKey, WorkspaceRole } from '@/lib/workspace-access';

export type WorkspaceMembershipUpsertPayload = {
  user_id: string;
  workspace_key: WorkspaceKey;
  role: WorkspaceRole;
  is_active: boolean;
  updated_at?: string;
};

type UpsertResult =
  | { ok: true; usedFallback: boolean; upserted: number }
  | { ok: false; usedFallback: boolean; error: string };

function shouldUseConflictFallback(message: string, code?: string): boolean {
  if (code === '42P10') return true;
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
    const { data: existing, error: existingError } = await db
      .from('workspace_memberships')
      .select('id')
      .eq('user_id', membership.user_id)
      .eq('workspace_key', membership.workspace_key)
      .maybeSingle();

    if (existingError) {
      return { ok: false, usedFallback: true, error: existingError.message };
    }

    if (existing?.id) {
      const { error: updateError } = await db
        .from('workspace_memberships')
        .update({
          role: membership.role,
          is_active: membership.is_active,
          updated_at: membership.updated_at ?? new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        return { ok: false, usedFallback: true, error: updateError.message };
      }
      continue;
    }

    const { error: insertError } = await db.from('workspace_memberships').insert({
      user_id: membership.user_id,
      workspace_key: membership.workspace_key,
      role: membership.role,
      is_active: membership.is_active,
      updated_at: membership.updated_at ?? new Date().toISOString(),
    });

    if (insertError) {
      return { ok: false, usedFallback: true, error: insertError.message };
    }
  }

  return { ok: true, usedFallback: true, upserted: memberships.length };
}

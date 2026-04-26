import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fills in the workspace client display name when the UI sent clientId but an
 * empty clientName (or whitespace-only), so storage keys and assets.client_name
 * stay consistent with the clients table.
 */
export async function resolveUploadClientDisplayName(
  supabase: SupabaseClient,
  workspaceId: string,
  rawClientName: string,
  clientId: string | null,
): Promise<string> {
  const trimmed = rawClientName.trim();
  if (trimmed) return trimmed;
  if (!clientId?.trim()) return '';
  const id = clientId.trim();
  const { data } = await supabase
    .from('clients')
    .select('name')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return (data?.name as string | undefined)?.trim() ?? '';
}

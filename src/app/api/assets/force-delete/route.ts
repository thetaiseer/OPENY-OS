import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { deleteObject } from '@/lib/storage/r2';

type ForceDeleteBody = {
  assetId?: string;
  folder?: string;
  clientId?: string;
};

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: { message: 'Server storage configuration missing', requestId } },
        { status: 500 },
      );
    }
    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as ForceDeleteBody;
    const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : '';
    const folder = typeof body.folder === 'string' ? body.folder.trim() : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';

    if (!assetId && !folder && !clientId) {
      return NextResponse.json(
        { success: false, error: { message: 'Missing assetId or folder', requestId } },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: { message: 'Not authenticated', requestId } },
        { status: 401 },
      );
    }

    const { data: membership, error: memberError } = await admin
      .from('workspace_members')
      .select('workspace_id, role, status')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin', 'manager'])
      .in('status', ['active', 'pending'])
      .limit(1)
      .maybeSingle();

    if (memberError || !membership?.workspace_id) {
      return NextResponse.json(
        { success: false, error: { message: 'No delete permission', requestId } },
        { status: 403 },
      );
    }

    const workspaceId = membership.workspace_id as string;
    let assets: Array<{
      id: string;
      name: string | null;
      folder?: string | null;
      client_name?: string | null;
      client_folder_name?: string | null;
      storage_key?: string | null;
      file_path?: string | null;
      storage_provider?: string | null;
    }> | null = null;

    if (assetId) {
      const { data, error } = await admin
        .from('assets')
        .select('id, name, storage_key, file_path, storage_provider')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .eq('id', assetId);
      if (error) {
        return NextResponse.json(
          { success: false, error: { message: error.message, requestId } },
          { status: 500 },
        );
      }
      assets = data ?? [];
    } else if (clientId || folder) {
      // Primary match by client_id FK (most reliable for assets linked to a client record).
      if (clientId) {
        const { data, error } = await admin
          .from('assets')
          .select('id, name, storage_key, file_path, storage_provider')
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .eq('client_id', clientId);
        if (error) {
          return NextResponse.json(
            { success: false, error: { message: error.message, requestId } },
            { status: 500 },
          );
        }
        assets = data ?? [];
      }

      // If clientId produced no results (or was not supplied), fall back to matching
      // by the `folder` column and then by the legacy client_name / client_folder_name columns.
      if (!assets?.length && folder) {
        const { data, error } = await admin
          .from('assets')
          .select('id, name, folder, storage_key, file_path, storage_provider')
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .eq('folder', folder);

        if (error && error.code !== '42703') {
          return NextResponse.json(
            { success: false, error: { message: error.message, requestId } },
            { status: 500 },
          );
        }

        if (!error && (data ?? []).length > 0) {
          assets = data!;
        } else {
          const fallback = await admin
            .from('assets')
            .select(
              'id, name, client_name, client_folder_name, storage_key, file_path, storage_provider',
            )
            .eq('workspace_id', workspaceId)
            .is('deleted_at', null)
            .or('is_deleted.is.null,is_deleted.eq.false')
            .or(`client_name.eq."${folder}",client_folder_name.eq."${folder}"`);
          if (fallback.error) {
            return NextResponse.json(
              { success: false, error: { message: fallback.error.message, requestId } },
              { status: 500 },
            );
          }
          assets = fallback.data ?? [];
        }
      }
    }

    if (!assets?.length) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'No active assets matched this delete request',
            requestId,
            details: { assetId: assetId || null, folder: folder || null, workspaceId },
          },
        },
        { status: 404 },
      );
    }

    for (const asset of assets) {
      const key = asset.storage_key || asset.file_path;
      if (key && (asset.storage_provider ?? 'r2') === 'r2') {
        try {
          await deleteObject(key);
        } catch (error) {
          console.warn('[force-delete] R2 delete failed, continuing DB delete', {
            requestId,
            assetId: asset.id,
            key,
            error,
          });
        }
      }
    }

    const ids = assets.map((a) => a.id);
    await admin.from('task_asset_links').delete().in('asset_id', ids);
    await admin.from('publishing_schedules').update({ asset_id: null }).in('asset_id', ids);
    await admin.from('tasks').update({ asset_id: null }).in('asset_id', ids);

    const { error: updateError } = await admin
      .from('assets')
      .update({
        deleted_at: new Date().toISOString(),
        is_deleted: true,
        sync_status: 'deleted',
        missing_in_storage: false,
      })
      .in('id', ids)
      .eq('workspace_id', workspaceId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: { message: updateError.message, requestId } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      deletedCount: ids.length,
      ids,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown delete error',
          requestId,
        },
      },
      { status: 500 },
    );
  }
}

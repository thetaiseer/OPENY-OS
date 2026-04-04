import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function getDriveClient() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

type AssetRow = { id: string; name: string; drive_file_id: string | null };

// Check which Drive file IDs are missing (HTTP 404), 20 at a time
async function findOrphanedIds(assets: AssetRow[]): Promise<string[]> {
  const drive = getDriveClient();
  if (!drive) return [];

  const orphanedIds: string[] = [];
  const CONCURRENCY = 20;

  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async asset => {
        if (!asset.drive_file_id) return;
        try {
          await drive.files.get({ fileId: asset.drive_file_id, fields: 'id' });
        } catch (err: unknown) {
          const status = (err as { code?: number })?.code;
          if (status === 404) {
            orphanedIds.push(asset.id);
          }
          // Skip transient / auth errors to avoid false positives
        }
      }),
    );
  }

  return orphanedIds;
}

/**
 * GET /api/assets/cleanup
 * Find DB asset records whose Google Drive file is confirmed missing (404).
 */
export async function GET(_req: NextRequest) {
  const supabase = getSupabase();

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET || !process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Google Drive credentials not configured' }, { status: 500 });
  }

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, name, drive_file_id')
    .eq('storage_provider', 'google_drive')
    .not('drive_file_id', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (assets ?? []) as AssetRow[];
  const orphanedIds = await findOrphanedIds(list);
  const orphaned = list.filter(a => orphanedIds.includes(a.id)).map(a => ({
    id: a.id, name: a.name, drive_file_id: a.drive_file_id,
  }));

  return NextResponse.json({ orphaned, total: list.length, orphanedCount: orphaned.length });
}

/**
 * DELETE /api/assets/cleanup
 * Delete DB records whose Google Drive file is confirmed missing (404).
 */
export async function DELETE(_req: NextRequest) {
  const supabase = getSupabase();

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET || !process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return NextResponse.json({ error: 'Google Drive credentials not configured' }, { status: 500 });
  }

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, name, drive_file_id')
    .eq('storage_provider', 'google_drive')
    .not('drive_file_id', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (assets ?? []) as AssetRow[];
  const orphanedIds = await findOrphanedIds(list);

  if (orphanedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .in('id', orphanedIds);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete orphaned records: ${deleteError.message}`, attempted: orphanedIds },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ deleted: orphanedIds.length, ids: orphanedIds });
}

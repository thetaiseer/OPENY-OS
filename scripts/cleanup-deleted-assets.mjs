#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  R2_ENDPOINT,
  R2_REGION,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error(
    'Missing R2 env vars. Required: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME',
  );
  process.exit(1);
}

const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const r2 = new S3Client({
  region: R2_REGION || 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function storageKeyFromAsset(asset) {
  const key = (asset.storage_key || '').trim() || (asset.file_path || '').trim();
  return key ? key.replace(/^\/+/, '') : null;
}

async function objectExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (error) {
    const code = String(error?.name || error?.Code || '');
    const status = Number(error?.$metadata?.httpStatusCode || 0);
    const msg = String(error?.message || '').toLowerCase();
    if (
      status === 404 ||
      code.includes('NotFound') ||
      code.includes('NoSuchKey') ||
      msg.includes('not found')
    ) {
      return false;
    }
    throw error;
  }
}

async function run() {
  const nowIso = new Date().toISOString();
  const pageSize = 500;
  let offset = 0;
  let scanned = 0;
  let missing = 0;
  let marked = 0;

  while (true) {
    const { data, error } = await db
      .from('assets')
      .select(
        'id, name, file_path, storage_key, storage_provider, deleted_at, is_deleted, missing_in_storage, sync_status',
      )
      .is('deleted_at', null)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .or('missing_in_storage.is.null,missing_in_storage.eq.false')
      .not('sync_status', 'in', '("deleted","missing")')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;

    scanned += rows.length;
    const missingIds = [];
    for (const row of rows) {
      if ((row.storage_provider || 'r2') !== 'r2') continue;
      const key = storageKeyFromAsset(row);
      if (!key) {
        missingIds.push(row.id);
        continue;
      }
      const exists = await objectExists(key);
      if (!exists) missingIds.push(row.id);
    }

    if (missingIds.length) {
      missing += missingIds.length;
      const { error: updateError } = await db
        .from('assets')
        .update({
          deleted_at: nowIso,
          is_deleted: true,
          sync_status: 'missing',
          missing_in_storage: true,
          updated_at: nowIso,
        })
        .in('id', missingIds);
      if (updateError) throw updateError;
      marked += missingIds.length;
    }

    offset += pageSize;
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        scanned,
        missingDetected: missing,
        markedMissing: marked,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      { success: false, error: error?.message || String(error), code: error?.code || null },
      null,
      2,
    ),
  );
  process.exit(1);
});

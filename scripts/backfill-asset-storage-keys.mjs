#!/usr/bin/env node
/**
 * One-time backfill: normalize display_name / original_name, infer storage_key from public URLs when possible.
 *
 * Usage (with env from .env.local via dotenv if you add it, or export manually):
 *   node scripts/backfill-asset-storage-keys.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const r2Base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function inferKeyFromUrl(publicUrl) {
  if (!publicUrl || !r2Base) return null;
  const u = String(publicUrl).trim();
  if (!u.startsWith(`${r2Base}/`)) return null;
  const path = u.slice(r2Base.length + 1);
  try {
    return decodeURIComponent(path.replace(/^\/+/, ''));
  } catch {
    return path.replace(/^\/+/, '');
  }
}

async function main() {
  const pageSize = 200;
  let from = 0;
  let updated = 0;
  let needsReview = 0;

  for (;;) {
    const { data: rows, error } = await supabase
      .from('assets')
      .select(
        'id, name, file_path, storage_key, file_url, view_url, download_url, public_url, display_name, original_name, sync_status',
      )
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(error);
      process.exit(1);
    }
    if (!rows?.length) break;

    for (const row of rows) {
      const patch = {};
      const name = row.name ?? 'file';
      if (!row.display_name) patch.display_name = name;
      if (!row.original_name) patch.original_name = row.original_filename ?? name;

      let sk = (row.storage_key ?? '').trim() || (row.file_path ?? '').trim();
      if (!sk) {
        sk =
          inferKeyFromUrl(row.public_url) ??
          inferKeyFromUrl(row.file_url) ??
          inferKeyFromUrl(row.view_url) ??
          inferKeyFromUrl(row.download_url);
        if (sk) {
          patch.storage_key = sk;
          patch.file_path = sk;
        } else {
          patch.sync_status = 'needs_review';
          needsReview++;
        }
      }

      if (Object.keys(patch).length === 0) continue;

      const { error: upErr } = await supabase.from('assets').update(patch).eq('id', row.id);
      if (upErr) {
        console.warn('skip row', row.id, upErr.message);
        continue;
      }
      updated++;
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log(
    `Done. Updated ${updated} rows; marked needs_review on ${needsReview} rows (no inferable key).`,
  );
}

void main();

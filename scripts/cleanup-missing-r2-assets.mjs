#!/usr/bin/env node
/**
 * Emergency cleanup script: hard-delete asset DB records whose R2 objects are
 * already gone (ghost records).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-missing-r2-assets.mjs
 *
 * Options (env vars):
 *   DRY_RUN=true   — print which records would be deleted without touching the DB
 *   WORKSPACE_ID=  — restrict cleanup to a single workspace UUID
 *
 * Safety:
 *   - Only removes rows where missing_in_storage = true (set by POST /api/assets/sync-r2).
 *   - Prints a summary before deleting; requires manual confirmation unless CI=true.
 *   - Never touches R2 — R2 objects are already gone at this point.
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'node:readline';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? null;
const CI = process.env.CI === 'true';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
      'Example:\n' +
      '  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/cleanup-missing-r2-assets.mjs',
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function confirm(question) {
  if (CI) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('─'.repeat(60));
  console.log('OPENY OS — Missing R2 Assets Cleanup');
  console.log('─'.repeat(60));
  if (DRY_RUN) console.log('Mode: DRY RUN (no changes will be made)\n');
  else console.log('Mode: LIVE (will delete DB records)\n');

  // Fetch ghost records.
  let query = db
    .from('assets')
    .select('id, name, storage_key, workspace_id, created_at')
    .eq('missing_in_storage', true);

  if (WORKSPACE_ID) query = query.eq('workspace_id', WORKSPACE_ID);

  const { data: ghosts, error } = await query;

  if (error) {
    console.error('Failed to fetch missing assets:', error.message);
    process.exit(1);
  }

  if (!ghosts || ghosts.length === 0) {
    console.log('No missing assets found. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${ghosts.length} ghost record(s):\n`);
  for (const asset of ghosts) {
    console.log(
      `  • [${asset.id}] "${asset.name}" (key: ${asset.storage_key ?? 'N/A'}) — workspace: ${asset.workspace_id ?? 'N/A'} — created: ${asset.created_at}`,
    );
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN complete. Re-run without DRY_RUN=true to delete these records.');
    process.exit(0);
  }

  const proceed = await confirm(
    `Delete ${ghosts.length} ghost record(s) from the database? [y/N] `,
  );
  if (!proceed) {
    console.log('Aborted.');
    process.exit(0);
  }

  const ids = ghosts.map((g) => g.id);
  let deleted = 0;
  let failed = 0;

  // Delete in batches of 50.
  const BATCH = 50;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);

    // Clean up related rows first (best-effort).
    await Promise.allSettled([
      db.from('publishing_schedules').delete().in('asset_id', batch),
      db.from('task_asset_links').delete().in('asset_id', batch),
      db.from('tasks').update({ asset_id: null }).in('asset_id', batch),
      db.from('comments').delete().in('asset_id', batch),
      db.from('activities').delete().eq('entity_type', 'asset').in('entity_id', batch),
    ]);

    const { error: delError } = await db.from('assets').delete().in('id', batch);
    if (delError) {
      console.error(`Batch delete failed: ${delError.message}`);
      failed += batch.length;
    } else {
      deleted += batch.length;
    }
  }

  console.log(`\nDone. Deleted: ${deleted} | Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

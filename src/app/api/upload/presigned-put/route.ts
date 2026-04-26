import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { resolveUploadClientDisplayName } from '@/lib/upload-resolve-client-name';
import {
  getFileUrl,
  getPresignedPutObjectUploadUrl,
  getStorageBucketName,
  R2ConfigError,
} from '@/lib/storage';
import {
  checkUploadHourlyLimit,
  getMaxUploadBytes,
  getMultipartThresholdBytes,
  uploadSizeExceededMessage,
} from '@/lib/upload-limits';
import {
  buildStorageKey,
  MAIN_CATEGORIES,
  SUBCATEGORIES,
  type MainCategorySlug,
} from '@/lib/asset-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'sh',
  'bash',
  'ps1',
  'msi',
  'vbs',
  'php',
  'py',
  'rb',
  'pl',
  'cgi',
  'app',
  'com',
  'scr',
  'pif',
  'reg',
  'dll',
  'so',
]);

const VALID_MAIN_CATEGORIES: string[] = MAIN_CATEGORIES.map((c) => c.slug);

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function sanitizeFileName(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
}

/**
 * POST /api/upload/presigned-put
 *
 * JSON-only: returns a short-lived presigned PUT URL so the browser uploads
 * directly to R2 (zero file bytes through Vercel / Next.js).
 *
 * Body fields match `/api/upload/multipart-init`. Only files up to the
 * multipart threshold may use this route; larger files must use multipart + presigned parts.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const rl = checkUploadHourlyLimit(auth.profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Upload limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fileName = (body.fileName as string | undefined)?.trim() ?? '';
  const fileType = (body.fileType as string | undefined)?.trim() ?? 'application/octet-stream';
  const fileSize = Number(body.fileSize ?? 0);
  let clientName = (body.clientName as string | undefined)?.trim() ?? '';
  const clientId = (body.clientId as string | undefined)?.trim() || null;
  const mainCategory = (body.mainCategory as string | undefined)?.trim() ?? '';
  const subCategory = (body.subCategory as string | undefined)?.trim() ?? '';
  const monthKey = (body.monthKey as string | undefined)?.trim() ?? '';
  const customName = (body.customFileName as string | undefined)?.trim() || null;

  const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

  if (!fileName) return fail('fileName is required');
  if (!mainCategory) return fail('mainCategory is required');
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return fail('monthKey must be YYYY-MM');

  let supabase: ReturnType<typeof getServiceClient>;
  try {
    supabase = getServiceClient();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Supabase configuration error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
    req,
    supabase,
    auth.profile.id,
  );
  if (!workspaceId) {
    return NextResponse.json(
      { error: workspaceError ?? 'Unable to resolve workspace from session' },
      { status: 403 },
    );
  }

  clientName = await resolveUploadClientDisplayName(supabase, workspaceId, clientName, clientId);
  if (!clientName) {
    return fail(
      'clientName is required, or pass a valid clientId in this workspace so the name can be resolved.',
    );
  }

  if (!VALID_MAIN_CATEGORIES.includes(mainCategory)) {
    return fail(`Invalid mainCategory. Must be one of: ${VALID_MAIN_CATEGORIES.join(', ')}`);
  }

  if (subCategory) {
    const validSubs = (SUBCATEGORIES[mainCategory as MainCategorySlug] ?? []).map((s) => s.slug);
    if (validSubs.length > 0 && !validSubs.includes(subCategory)) {
      return fail(`Invalid subCategory "${subCategory}" for mainCategory "${mainCategory}"`);
    }
  }

  const ext = getExtension(fileName);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return fail('File type not allowed: executable and script files are blocked');
  }

  if (!fileSize || fileSize <= 0) return fail('fileSize must be a positive number');

  const maxBytes = getMaxUploadBytes();
  if (maxBytes > 0 && fileSize > maxBytes) {
    return NextResponse.json({ error: uploadSizeExceededMessage(maxBytes) }, { status: 413 });
  }

  const multipartThreshold = getMultipartThresholdBytes();
  if (fileSize > multipartThreshold) {
    return NextResponse.json(
      {
        error: `This file is ${(fileSize / (1024 * 1024)).toFixed(1)} MB. Use multipart presigned upload for files over ${(multipartThreshold / (1024 * 1024)).toFixed(0)} MB.`,
        code: 'USE_MULTIPART',
      },
      { status: 413 },
    );
  }

  const sanitizedFile = sanitizeFileName(fileName);
  const timestamp = Date.now();

  const storageKey = buildStorageKey({
    clientName,
    clientId,
    mainCategory,
    subCategory: subCategory || 'general',
    monthKey,
    fileName: sanitizedFile,
    timestamp,
  });

  let displayName: string;
  if (customName) {
    const base = sanitizeFileName(customName);
    const dotExt = ext ? `.${ext}` : '';
    displayName =
      dotExt && base.toLowerCase().endsWith(dotExt.toLowerCase()) ? base : `${base}${dotExt}`;
  } else {
    displayName = `${timestamp}-${sanitizedFile}`;
  }

  const bucketName = getStorageBucketName();
  const contentType = fileType || 'application/octet-stream';

  try {
    const putUrl = await getPresignedPutObjectUploadUrl(storageKey, contentType, 3600);
    const publicUrl = getFileUrl(storageKey);
    return NextResponse.json({ putUrl, storageKey, publicUrl, displayName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConfigErr = err instanceof R2ConfigError;
    console.error('[upload/presigned-put] failure', {
      provider: 'r2',
      bucketName,
      storageKey,
      error: msg,
    });
    return NextResponse.json({ error: msg }, { status: isConfigErr ? 500 : 502 });
  }
}

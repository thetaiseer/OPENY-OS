// UPDATED FILE
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
import { allocateWorkspaceAssetStorageKey } from '@/lib/assets/allocate-workspace-asset-key';
import { MAIN_CATEGORIES, SUBCATEGORIES, type MainCategorySlug } from '@/lib/asset-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const VALID_MAIN_CATEGORIES: string[] = MAIN_CATEGORIES.map((c) => c.slug);

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

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

  if (!VALID_MAIN_CATEGORIES.includes(mainCategory)) {
    return NextResponse.json({ error: `Invalid mainCategory` }, { status: 400 });
  }

  let supabase = getServiceClient();
  const { workspaceId } = await resolveWorkspaceForRequest(req, supabase, auth.profile.id);

  clientName = await resolveUploadClientDisplayName(supabase, workspaceId!, clientName, clientId);

  const { storageKey } = await allocateWorkspaceAssetStorageKey(
    workspaceId!,
    clientId,
    monthKey,
    fileName,
    mainCategory,
    subCategory
  );

  const putUrl = await getPresignedPutObjectUploadUrl(storageKey, fileType, 3600);
  const publicUrl = getFileUrl(storageKey);

  return NextResponse.json({ putUrl, storageKey, publicUrl });
}

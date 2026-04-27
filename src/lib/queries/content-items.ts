export const CONTENT_ITEMS_BASE_SELECT = [
  'id',
  'workspace_id',
  'client_id',
  'task_id',
  'approval_id',
  'created_by',
  'title',
  'description',
  'caption',
  'status',
  'platform',
  'platform_targets',
  'post_types',
  'purpose',
  'schedule_date',
  'created_at',
  'updated_at',
].join(',');

export const CONTENT_ITEMS_BASE_SELECT_FALLBACK = [
  'id',
  'workspace_id',
  'client_id',
  'task_id',
  'approval_id',
  'created_by',
  'title',
  'description',
  'caption',
  'status',
  'platform',
  'post_types',
  'purpose',
  'schedule_date',
  'created_at',
  'updated_at',
].join(',');

export const CONTENT_ITEMS_WITH_CLIENT_SELECT = `${CONTENT_ITEMS_BASE_SELECT},client:clients(id, name)`;
export const CONTENT_ITEMS_WITH_CLIENT_SELECT_FALLBACK = `${CONTENT_ITEMS_BASE_SELECT_FALLBACK},client:clients(id, name)`;

export function resolvePlatformTargets(
  item: Pick<
    { platform_targets?: string[] | null; platform?: string | null },
    'platform_targets' | 'platform'
  >,
): string[] {
  if (Array.isArray(item.platform_targets) && item.platform_targets.length > 0) {
    return item.platform_targets;
  }
  return [item.platform].filter((value): value is string => Boolean(value));
}

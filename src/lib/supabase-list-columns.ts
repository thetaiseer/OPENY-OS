import {
  CONTENT_ITEMS_WITH_CLIENT_SELECT,
  CONTENT_ITEMS_WITH_CLIENT_SELECT_FALLBACK,
  CONTENT_ITEMS_BASE_SELECT,
  CONTENT_ITEMS_BASE_SELECT_FALLBACK,
} from '@/lib/queries/content-items';

/**
 * Narrow PostgREST column lists for list views — smaller payloads than select('*').
 * Keep in sync with `Client`, `Task`, `Asset`, and `Notification` in `lib/types`.
 */
export const CLIENT_LIST_COLUMNS =
  'id,name,email,phone,website,industry,status,logo,notes,slug,default_currency,created_at,updated_at';

export const TASK_LIST_COLUMNS = [
  'id',
  'title',
  'description',
  'status',
  'position',
  'priority',
  'start_date',
  'due_date',
  'due_time',
  'timezone',
  'task_date',
  'task_category',
  'content_purpose',
  'caption',
  'notes',
  'client_id',
  'assignee_id',
  'created_by_id',
  'project_id',
  'content_item_id',
  'mentions',
  'tags',
  'created_at',
  'updated_at',
  'publishing_schedule_id',
  'asset_id',
  'platforms',
  'post_types',
  'reminder_at',
].join(',');

export const ASSET_LIST_COLUMNS = [
  'id',
  'name',
  'file_path',
  'file_url',
  'view_url',
  'download_url',
  'file_type',
  'file_size',
  'bucket_name',
  'storage_provider',
  'client_folder_name',
  'content_type',
  'month_key',
  'task_id',
  'client_id',
  'client_name',
  'uploaded_by',
  'mime_type',
  'preview_url',
  'thumbnail_url',
  'web_view_link',
  'tags',
  'main_category',
  'sub_category',
  'storage_key',
  'created_at',
].join(',');

// Backward-compatible projection for databases that still miss legacy columns
// like `file_path`. Keep this list as a safe subset for list rendering.
export const ASSET_LIST_COLUMNS_LEGACY = [
  'id',
  'name',
  'file_url',
  'view_url',
  'download_url',
  'file_type',
  'file_size',
  'bucket_name',
  'storage_provider',
  'client_folder_name',
  'content_type',
  'month_key',
  'task_id',
  'client_id',
  'client_name',
  'uploaded_by',
  'mime_type',
  'preview_url',
  'thumbnail_url',
  'web_view_link',
  'tags',
  'main_category',
  'sub_category',
  'storage_key',
  'created_at',
].join(',');

/** Oldest-safe list projection (no tags / categories / storage_key / file_path). */
export const ASSET_LIST_COLUMNS_MINIMAL = [
  'id',
  'name',
  'file_url',
  'view_url',
  'download_url',
  'file_type',
  'file_size',
  'bucket_name',
  'storage_provider',
  'client_folder_name',
  'content_type',
  'month_key',
  'task_id',
  'client_id',
  'client_name',
  'uploaded_by',
  'mime_type',
  'preview_url',
  'thumbnail_url',
  'web_view_link',
  'created_at',
].join(',');

export const ACTIVITY_LIST_COLUMNS =
  'id,type,module,title,description,status,user_id,user_uuid,user_role,client_id,entity_type,entity_id,related_entity_type,related_entity_id,metadata_json,created_at';

export const COMMENT_LIST_COLUMNS =
  'id,content,user_id,user_name,asset_id,task_id,entity_type,entity_id,parent_id,mentions,is_resolved,created_at';

export const NOTIFICATION_LIST_COLUMNS = [
  'id',
  'title',
  'message',
  'type',
  'module',
  'read',
  'read_at',
  'priority',
  'category',
  'is_archived',
  'actor_id',
  'created_by',
  'metadata',
  'client_id',
  'user_id',
  'task_id',
  'entity_type',
  'entity_id',
  'action_url',
  'event_type',
  'delivered_in_app',
  'delivered_email',
  'workspace_id',
  'idempotency_key',
  'created_at',
].join(',');

/** Full activity row for API list/insert responses (includes v2 audit columns). */
export const ACTIVITY_API_COLUMNS = [
  'id',
  'type',
  'module',
  'description',
  'status',
  'user_id',
  'user_uuid',
  'user_role',
  'client_id',
  'entity_type',
  'entity_id',
  'related_entity_type',
  'related_entity_id',
  'metadata_json',
  'created_at',
  'workspace_id',
  'actor_id',
  'title',
  'before_value',
  'after_value',
  'category',
].join(',');

export const USER_SESSION_COLUMNS =
  'id,user_id,ip_address,country,city,user_agent,browser,os,device_type,is_active,last_seen_at,created_at,revoked_at,revoked_by,risk_flag';

export const USER_SESSION_COLUMNS_LEGACY =
  'id,user_id,ip_address,user_agent,browser,os,device_type,is_active,last_seen_at,created_at,revoked_at,revoked_by,risk_flag';

export const USER_SESSION_COLUMNS_MIN =
  'id,user_id,ip_address,browser,os,device_type,is_active,last_seen_at,created_at,revoked_at,revoked_by,risk_flag';

export const NOTE_COLUMNS =
  'id,workspace_id,title,content,entity_type,entity_id,is_pinned,created_by,created_at,updated_at';

export const TAG_COLUMNS = 'id,workspace_id,name,color,description,created_at';

export const ENTITY_LINK_COLUMNS =
  'id,workspace_id,source_type,source_id,target_type,target_id,link_type,metadata,created_by,created_at';

export const SAVED_VIEW_COLUMNS =
  'id,workspace_id,user_id,entity_type,name,view_type,filters,sort_config,group_by,columns,is_default,is_shared,created_at';

export const AUTOMATION_RULE_COLUMNS =
  'id,workspace_id,name,description,is_active,trigger_type,trigger_config,conditions,actions,created_by,created_at,updated_at,run_count,last_run_at,error_count';

export const PROJECT_LIST_COLUMNS =
  'id,workspace_id,client_id,name,description,status,start_date,end_date,color,created_by,created_at,updated_at';

export const PROJECT_WITH_CLIENT = `${PROJECT_LIST_COLUMNS},client:clients(id, name, slug)`;

export const CONTENT_ITEM_LIST_COLUMNS = CONTENT_ITEMS_BASE_SELECT;

export const CONTENT_ITEM_WITH_CLIENT = CONTENT_ITEMS_WITH_CLIENT_SELECT;

// Fallback projection for environments that have not fully applied v2 content migrations.
export const CONTENT_ITEM_LIST_COLUMNS_FALLBACK = CONTENT_ITEMS_BASE_SELECT_FALLBACK;

export const CONTENT_ITEM_WITH_CLIENT_FALLBACK = CONTENT_ITEMS_WITH_CLIENT_SELECT_FALLBACK;

export const CALENDAR_EVENT_COLUMNS =
  'id,workspace_id,title,client_id,task_id,publishing_schedule_id,event_type,starts_at,ends_at,status,notes,created_at,updated_at';

export const CALENDAR_EVENT_WITH_RELATIONS = `${CALENDAR_EVENT_COLUMNS},client:clients(id,name),task:tasks(id,title,status,priority)`;

export const TIME_ENTRY_COLUMNS =
  'id,workspace_id,task_id,client_id,user_id,description,started_at,ended_at,duration_seconds,is_running,billable,created_at,updated_at';

export const TIME_ENTRY_WITH_RELATIONS = `${TIME_ENTRY_COLUMNS},task:tasks(id, title),client:clients(id, name)`;

export const PUBLISHING_SCHEDULE_COLUMNS =
  'id,workspace_id,asset_id,content_item_id,client_id,client_name,scheduled_date,scheduled_time,timezone,platforms,post_types,caption,notes,status,assigned_to,assignee_name,reminder_minutes,task_id,published_at,created_by,created_by_name,created_at,updated_at';

export const PUBLISHING_SCHEDULE_WITH_ASSET = `${PUBLISHING_SCHEDULE_COLUMNS},asset:assets(id, name, content_type, file_url, preview_url, client_name)`;

export const TASK_WITH_CLIENT = `${TASK_LIST_COLUMNS},client:clients(id,name,logo,slug)`;

export const NOTIFICATION_PREF_COLUMNS =
  'id,user_id,event_type,in_app_enabled,email_enabled,realtime_enabled,digest_enabled,mute_until,created_at,updated_at';

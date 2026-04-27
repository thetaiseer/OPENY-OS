export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  status?: 'active' | 'inactive' | 'suspended';
  client_id?: string | null;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  status: 'active' | 'inactive' | 'prospect';
  logo?: string;
  notes?: string;
  slug?: string;
  default_currency?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  membership_id?: string | null;
  user_id?: string | null;
  full_name: string;
  email: string;
  role?: string;
  job_title?: string;
  avatar?: string;
  profile_id?: string | null;
  status?: 'active' | 'pending' | 'invited' | 'inactive' | 'suspended';
  created_at: string;
  updated_at?: string;
}

export type InviteStatus = 'pending' | 'invited' | 'accepted' | 'expired' | 'revoked';

// ── Permission system ─────────────────────────────────────────────────────────

/** Three access levels for each module */
export type ModuleAccess = 'full' | 'read' | 'none';

/** Top-level roles within OPENY Platform */
export type PlatformRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

/** Modules available in OPENY OS */
export type OsModule =
  | 'dashboard'
  | 'clients'
  | 'tasks'
  | 'content'
  | 'calendar'
  | 'assets'
  | 'reports'
  | 'team'
  | 'activity'
  | 'security';

/** Modules available in OPENY DOCS */
export type DocsModule = 'invoice' | 'quotation' | 'contracts' | 'accounting';

/** Canonical member permission record stored in member_permissions table */
export interface MemberPermissionRow {
  id: string;
  team_member_id: string;
  workspace: 'os' | 'docs';
  module: string;
  access_level: ModuleAccess;
  created_at: string;
  updated_at: string;
}

/** Full permission profile for a member: role + workspace + module access */
export interface MemberPermissions {
  role: PlatformRole;
  os: Record<OsModule, ModuleAccess>;
  docs: Record<DocsModule, ModuleAccess>;
}

export interface TeamInvitation {
  id: string;
  team_member_id: string;
  email: string;
  role?: string;
  token: string;
  status: InviteStatus;
  invited_by?: string | null;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
  workspace_access?: Array<'os' | 'docs' | string> | null;
  workspace_roles?: Record<string, string> | null;
  team_member?:
    | {
        full_name?: string | null;
        job_title?: string | null;
        role?: string | null;
        status?: string | null;
      }
    | Array<{
        full_name?: string | null;
        job_title?: string | null;
        role?: string | null;
        status?: string | null;
      }>
    | null;
}

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  /** @deprecated use in_review */
  | 'review'
  | 'waiting_client'
  | 'approved'
  | 'scheduled'
  | 'published'
  /** @deprecated use completed */
  | 'done'
  | 'completed'
  /** @deprecated use completed */
  | 'delivered'
  | 'overdue'
  | 'cancelled';

export type TaskCategory =
  | 'internal_task'
  | 'content_creation'
  | 'design_task'
  | 'publishing_task'
  | 'asset_upload_task'
  | 'follow_up_task';

export type ContentPurpose =
  | 'awareness'
  | 'engagement'
  | 'promotion'
  | 'branding'
  | 'lead_generation'
  | 'announcement'
  | 'offer_campaign';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  position?: number | null;
  priority: 'low' | 'medium' | 'high';
  start_date?: string;
  due_date?: string;
  due_time?: string | null;
  timezone?: string | null;
  task_date?: string;
  task_category?: TaskCategory | null;
  content_purpose?: ContentPurpose | null;
  caption?: string | null;
  notes?: string | null;
  client_id?: string;
  /** @deprecated joined from clients table; use client.name instead */
  client_name?: string | null;
  /** @deprecated use assignee_id (UUID FK to profiles) */
  assigned_to?: string;
  /** UUID FK to profiles — canonical assignee reference */
  assignee_id?: string | null;
  /** @deprecated use created_by_id (UUID FK to profiles) */
  created_by?: string;
  /** UUID FK to profiles — canonical creator reference */
  created_by_id?: string | null;
  /** FK to projects */
  project_id?: string | null;
  /** FK to content_items */
  content_item_id?: string | null;
  mentions?: string[];
  tags?: string[];
  client?: { id: string; name: string; logo?: string | null; slug?: string | null };
  created_at: string;
  updated_at: string;
  /** Publishing schedule integration */
  publishing_schedule_id?: string | null;
  /** @deprecated use task_asset_links junction table for multi-asset support */
  asset_id?: string | null;
  platforms?: string[] | null;
  post_types?: string[] | null;
  reminder_at?: string | null;
}

export type ContentItemStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected';

export interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  /** @deprecated use platform_targets (array) */
  platform?: string;
  /** Array of target platforms */
  platform_targets?: string[];
  post_types?: string[];
  purpose?: ContentPurpose | null;
  caption?: string | null;
  status: ContentItemStatus;
  /** @deprecated replaced by publishing_schedules relationship */
  schedule_date?: string;
  client_id?: string;
  /** FK to tasks */
  task_id?: string | null;
  /** UUID FK to profiles */
  created_by?: string | null;
  client?: Client;
  created_at: string;
  updated_at: string;
}

export type AssetStatus = 'pending' | 'ready' | 'linked' | 'archived';

export interface Asset {
  id: string;
  name: string;
  original_filename?: string | null;
  file_path?: string | null;
  /**
   * @deprecated prefer web_view_link for display and download_url for downloads.
   * Kept as a required field for backward compat with existing pages.
   */
  file_url: string;
  /** @deprecated prefer web_view_link */
  view_url?: string | null;
  download_url?: string | null;
  file_type?: string;
  file_size?: number;
  bucket_name?: string | null;
  storage_provider?: string | null;
  client_folder_name?: string | null;
  content_type?: string | null;
  month_key?: string | null;
  /** Lifecycle status: pending | ready | linked | archived */
  status?: AssetStatus;
  task_id?: string | null;
  client_id?: string;
  /** Denormalized for search/display — source of truth is clients.name */
  client_name?: string | null;
  uploaded_by?: string | null;
  mime_type?: string | null;
  preview_url?: string | null;
  thumbnail_url?: string | null;
  web_view_link?: string | null;
  /** Duration of the video in seconds (null for non-video assets). */
  duration_seconds?: number | null;
  /** Preview generation state: pending | generating | ready | failed */
  preview_status?: string | null;
  last_synced_at?: string | null;
  source_updated_at?: string | null;
  is_deleted?: boolean;
  upload_state?: string | null;
  tags?: string[];
  version_number?: number;
  parent_asset_id?: string | null;
  /** New hierarchy fields (assets v2) */
  main_category?: string | null;
  sub_category?: string | null;
  /** Canonical storage key: clients/{slug}/{mainCat}/{year}/{month}/{subCat}/{ts}-{file} */
  storage_key?: string | null;
  created_at: string;
}

/**
 * Lightweight asset shape used in calendar views.
 * Matches the partial select: id, name, publish_date, content_type, client_name.
 */
export interface CalendarAsset {
  id: string;
  name: string;
  publish_date: string | null;
  content_type?: string | null;
  client_name?: string | null;
}

export interface Activity {
  id: string;
  type: string;
  module?: string | null;
  title?: string | null;
  description: string;
  /** @deprecated use user_uuid (UUID FK to profiles) */
  user_id?: string;
  /** UUID FK to profiles */
  user_uuid?: string | null;
  user_role?: string | null;
  client_id?: string;
  /** The type of entity this activity relates to (task, asset, etc.) */
  entity_type?: string | null;
  /** The UUID of the related entity */
  entity_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  status?: 'success' | 'failed' | 'pending' | string | null;
  /** Arbitrary structured data for the activity */
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

export type TaskAssetLink = {
  task_id: string;
  asset_id: string;
  linked_at: string;
  linked_by?: string | null;
  asset?: Pick<Asset, 'id' | 'name' | 'content_type' | 'web_view_link' | 'preview_url'> | null;
};

export type CalendarEventType =
  | 'task'
  | 'publishing'
  | 'deadline'
  | 'meeting'
  | 'reminder'
  | 'other';
export type CalendarEventStatus = 'active' | 'cancelled' | 'completed';

export interface CalendarEvent {
  id: string;
  title: string;
  client_id?: string | null;
  task_id?: string | null;
  publishing_schedule_id?: string | null;
  event_type: CalendarEventType;
  starts_at: string;
  ends_at?: string | null;
  status: CalendarEventStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  /** Joined relations */
  client?: Pick<Client, 'id' | 'name'> | null;
  task?: Pick<Task, 'id' | 'title' | 'status' | 'priority'> | null;
}

export interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  asset_id?: string | null;
  task_id?: string | null;
  /** v2 cross-entity fields */
  entity_type?: string | null;
  entity_id?: string | null;
  parent_id?: string | null;
  mentions?: string[] | null;
  is_resolved?: boolean;
  /** Nested replies (joined) */
  replies?: Comment[];
  created_at: string;
}

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationCategory = 'tasks' | 'content' | 'assets' | 'team' | 'system';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  module?: string | null;
  read: boolean;
  /** Optional: set by read action */
  read_at?: string | null;
  /** Priority level — drives visual treatment and email urgency */
  priority?: NotificationPriority;
  /** Module category for tab filtering */
  category?: NotificationCategory | null;
  /** Soft-delete — archived notifications are hidden from main view */
  is_archived?: boolean;
  actor_id?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown> | null;
  client_id?: string | null;
  user_id?: string | null;
  task_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  event_type?: string | null;
  /** Whether delivered in-app */
  delivered_in_app?: boolean;
  /** Whether email was sent */
  delivered_email?: boolean;
  workspace_id?: string | null;
  idempotency_key?: string | null;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  event_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  realtime_enabled: boolean;
  digest_enabled: boolean;
  mute_until?: string | null;
  created_at: string;
  updated_at: string;
}

export type ReminderStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

export interface ScheduledReminder {
  id: string;
  workspace_id?: string | null;
  target_user_id?: string | null;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  scheduled_for: string;
  status: ReminderStatus;
  idempotency_key?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export interface ActivityLogEntry {
  id: string;
  workspace_id?: string | null;
  /** UUID FK to profiles — canonical actor reference */
  actor_id?: string | null;
  /** @deprecated use actor_id (UUID) */
  user_id?: string | null;
  /** @deprecated use actor_id (UUID) */
  user_uuid?: string | null;
  type: string;
  module?: string | null;
  status?: 'success' | 'failed' | 'pending' | string | null;
  user_role?: string | null;
  category?: NotificationCategory | null;
  title?: string | null;
  description: string;
  entity_type?: string | null;
  entity_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  before_value?: Record<string, unknown> | null;
  after_value?: Record<string, unknown> | null;
  metadata_json?: Record<string, unknown> | null;
  client_id?: string | null;
  actor_name?: string | null;
  created_at: string;
}

export type PublishingPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'twitter'
  | 'snapchat'
  | 'youtube_shorts';

export type PublishingPostType = 'post' | 'reel' | 'carousel' | 'story';

export type PublishingStatus =
  | 'scheduled'
  | 'queued'
  | 'published'
  | 'missed'
  | 'cancelled'
  /** @deprecated use scheduled */
  | 'draft'
  /** @deprecated use scheduled */
  | 'pending_review'
  /** @deprecated use scheduled */
  | 'approved';

export interface PublishingSchedule {
  id: string;
  /** @deprecated nullable since schema v2 — use content_item_id for content-first workflows */
  asset_id?: string | null;
  /** FK to content_items — use for content-first publishing workflows */
  content_item_id?: string | null;
  client_id?: string | null;
  /** @deprecated joined from clients; use client.name */
  client_name?: string | null;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string;
  platforms: PublishingPlatform[];
  post_types: PublishingPostType[];
  caption?: string | null;
  notes?: string | null;
  status: PublishingStatus;
  assigned_to?: string | null;
  /** @deprecated joined from profiles; use assigned_to UUID */
  assignee_name?: string | null;
  reminder_minutes?: number | null;
  task_id?: string | null;
  created_by?: string | null;
  /** @deprecated joined from profiles */
  created_by_name?: string | null;
  /** Timestamp when this schedule was actually published */
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from assets table when fetching schedules */
  asset?: Pick<
    Asset,
    'id' | 'name' | 'content_type' | 'file_url' | 'preview_url' | 'client_name'
  > | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// v3 UNIFIED WORKSPACE TYPES
// ─────────────────────────────────────────────────────────────────────────────

// ── Projects ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  workspace_id?: string | null;
  client_id?: string | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  color?: string | null;
  health_status?: 'healthy' | 'at_risk' | 'critical';
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  /** Joined */
  client?: Pick<Client, 'id' | 'name' | 'slug'> | null;
  task_count?: number;
}

// ── Entity Links (relational graph) ──────────────────────────────────────────

export type EntityType = 'task' | 'asset' | 'content' | 'client' | 'project' | 'note' | 'template';
export type LinkType = 'related' | 'blocks' | 'blocked_by' | 'parent' | 'child' | 'duplicate';

export interface EntityLink {
  id: string;
  workspace_id?: string | null;
  source_type: EntityType;
  source_id: string;
  target_type: EntityType;
  target_id: string;
  link_type: LinkType;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at: string;
}

// ── Custom Fields ──────────────────────────────────────────────────────────────

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'boolean'
  | 'url'
  | 'email';

export interface CustomFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface CustomFieldDefinition {
  id: string;
  workspace_id?: string | null;
  entity_type: 'task' | 'client' | 'project' | 'content' | 'asset';
  name: string;
  field_key: string;
  field_type: CustomFieldType;
  options?: CustomFieldOption[] | null;
  required: boolean;
  default_value?: string | null;
  sort_order: number;
  created_at: string;
}

export interface CustomFieldValue {
  id: string;
  definition_id: string;
  entity_type: string;
  entity_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown;
  created_at: string;
  updated_at: string;
  /** Joined */
  definition?: CustomFieldDefinition | null;
}

// ── Notes ──────────────────────────────────────────────────────────────────────

export interface Note {
  id: string;
  workspace_id?: string | null;
  title: string;
  content?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  is_pinned: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  search_vector?: unknown;
}

export interface NoteLink {
  id: string;
  source_note_id: string;
  target_note_id?: string | null;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  created_at: string;
}

// ── Templates ──────────────────────────────────────────────────────────────────

export type TemplateEntityType = 'task' | 'client' | 'project' | 'content';

export interface Template {
  id: string;
  workspace_id?: string | null;
  name: string;
  description?: string | null;
  entity_type: TemplateEntityType;
  template_data: Record<string, unknown>;
  is_global: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  items?: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  template_id: string;
  title: string;
  description?: string | null;
  item_type: 'task' | 'note' | 'checklist_item' | 'content';
  sort_order: number;
  item_data: Record<string, unknown>;
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  workspace_id?: string | null;
  name: string;
  color: string;
  description?: string | null;
  created_at: string;
}

export interface TagLink {
  id: string;
  tag_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  /** Joined */
  tag?: Tag | null;
}

// ── Time Entries ──────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  workspace_id?: string | null;
  task_id?: string | null;
  client_id?: string | null;
  user_id?: string | null;
  description?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  is_running: boolean;
  billable: boolean;
  created_at: string;
  updated_at: string;
  /** Joined */
  task?: Pick<Task, 'id' | 'title'> | null;
  client?: Pick<Client, 'id' | 'name'> | null;
}

// ── Saved Views ───────────────────────────────────────────────────────────────

export type ViewType = 'list' | 'kanban' | 'calendar' | 'timeline' | 'table' | 'grid' | 'pipeline';

export interface SavedView {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  entity_type: 'task' | 'asset' | 'content' | 'client' | 'project';
  name: string;
  view_type: ViewType;
  filters: Record<string, unknown>;
  sort_config: Record<string, unknown>;
  group_by?: string | null;
  columns?: string[];
  is_default: boolean;
  is_shared: boolean;
  created_at: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardLayout {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  widgets?: DashboardWidget[];
}

export type DashboardWidgetType =
  | 'tasks_summary'
  | 'assets_count'
  | 'content_pipeline'
  | 'team_workload'
  | 'recent_activity'
  | 'client_list'
  | 'time_tracking'
  | 'overdue_tasks'
  | 'upcoming_schedule'
  | 'trend_chart';

export interface DashboardWidget {
  id: string;
  layout_id: string;
  widget_type: DashboardWidgetType;
  title?: string | null;
  config: Record<string, unknown>;
  grid_x: number;
  grid_y: number;
  grid_w: number;
  grid_h: number;
  created_at: string;
}

// ── AI Audit ──────────────────────────────────────────────────────────────────

export interface AiSession {
  id: string;
  workspace_id?: string | null;
  user_id?: string | null;
  mode: 'ask' | 'do' | 'suggest' | 'review';
  section?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at: string;
}

export interface AiAction {
  id: string;
  session_id?: string | null;
  workspace_id?: string | null;
  user_id?: string | null;
  intent: string;
  prompt: string;
  actions_taken: string[];
  response_text?: string | null;
  status: 'success' | 'error' | 'partial' | 'pending';
  error_message?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

// ── Automation Rules ──────────────────────────────────────────────────────────

export interface AutomationRule {
  id: string;
  workspace_id?: string | null;
  name: string;
  description?: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  run_count: number;
  last_run_at?: string | null;
  error_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'is_set' | 'is_empty';
  value?: unknown;
}

export interface AutomationAction {
  type:
    | 'send_notification'
    | 'create_task'
    | 'update_field'
    | 'assign_member'
    | 'add_tag'
    | 'send_email'
    | 'log_activity';
  config: Record<string, unknown>;
}

// ── Workspace Events ──────────────────────────────────────────────────────────

export interface WorkspaceEvent {
  id: string;
  workspace_id?: string | null;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED DOCUMENT BASE — common fields across all OPENY DOCS entities
// Docs-specific types in docs-types.ts extend or satisfy this interface.
// ─────────────────────────────────────────────────────────────────────────────

/** Fields shared by every OPENY DOCS document entity. */
export interface BaseDocument {
  id: string;
  /** FK to docs_client_profiles — the client this document belongs to. */
  client_profile_id?: string | null;
  /** ISO 8601 document creation date-time. */
  created_at: string;
  /** ISO 8601 last modification date-time. */
  updated_at: string;
  /** UUID of the team member who created the document. */
  created_by: string | null;
  /** Pre-signed or permanent URL for the exported PDF, if generated. */
  export_pdf_url?: string | null;
}

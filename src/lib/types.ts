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
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role?: string;
  job_title?: string;
  avatar?: string;
  profile_id?: string | null;
  status?: 'active' | 'invited' | 'inactive' | 'suspended';
  created_at: string;
  updated_at?: string;
}

export type InviteStatus = 'invited' | 'accepted' | 'expired' | 'revoked';

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
  | 'approval_task'
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
  /** FK to content_items */
  content_item_id?: string | null;
  /** FK to approvals */
  approval_id?: string | null;
  mentions?: string[];
  tags?: string[];
  client?: { id: string; name: string };
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
  /** FK to approvals */
  approval_id?: string | null;
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
  /** @deprecated use approvals table */
  publish_date?: string | null;
  /** @deprecated use approvals table */
  approval_status?: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'published' | null;
  /** @deprecated use approvals table */
  approval_notes?: string | null;
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

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  title?: string | null;
  status: ApprovalStatus;
  client_id?: string | null;
  /** FK to tasks */
  task_id?: string | null;
  /** FK to content_items */
  content_item_id?: string | null;
  /** FK to assets */
  asset_id?: string | null;
  /** UUID FK to profiles (the reviewer) */
  reviewer_id?: string | null;
  notes?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Joined relations */
  client?: Pick<Client, 'id' | 'name'> | null;
  reviewer?: Pick<TeamMember, 'id' | 'full_name' | 'email' | 'avatar'> | null;
  task?: Pick<Task, 'id' | 'title'> | null;
  asset?: Pick<Asset, 'id' | 'name'> | null;
  content_item?: Pick<ContentItem, 'id' | 'title'> | null;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  /** @deprecated use user_uuid (UUID FK to profiles) */
  user_id?: string;
  /** UUID FK to profiles */
  user_uuid?: string | null;
  client_id?: string;
  /** The type of entity this activity relates to (task, asset, approval, etc.) */
  entity_type?: string | null;
  /** The UUID of the related entity */
  entity_id?: string | null;
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

export type CalendarEventType = 'task' | 'publishing' | 'deadline' | 'meeting' | 'reminder' | 'other';
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
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  client_id?: string | null;
  user_id?: string | null;
  task_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  event_type?: string | null;
  created_at: string;
}

export interface ApprovalHistory {
  id: string;
  asset_id: string;
  action: 'approved' | 'rejected' | 'pending' | 'scheduled' | 'published';
  user_id?: string | null;
  user_name?: string | null;
  notes?: string | null;
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
  asset?: Pick<Asset, 'id' | 'name' | 'content_type' | 'file_url' | 'preview_url' | 'client_name'> | null;
}

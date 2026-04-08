export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  client_id?: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  created_at: string;
}

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'review'
  | 'waiting_client'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'done'
  | 'completed'
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
  client_id?: string;
  client_name?: string | null;
  assigned_to?: string;
  created_by?: string;
  mentions?: string[];
  tags?: string[];
  client?: { id: string; name: string };
  created_at: string;
  updated_at: string;
  /** Publishing schedule integration */
  publishing_schedule_id?: string | null;
  asset_id?: string | null;
  platforms?: string[] | null;
  post_types?: string[] | null;
}

export interface ContentItem {
  id: string;
  title: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published';
  schedule_date?: string;
  client_id?: string;
  client?: Client;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  name: string;
  file_path: string | null;
  file_url: string;
  view_url?: string | null;
  download_url?: string | null;
  file_type?: string;
  file_size?: number;
  bucket_name: string | null;
  storage_provider?: string | null;
  drive_file_id?: string | null;
  drive_folder_id?: string | null;
  client_folder_name?: string | null;
  content_type?: string | null;
  month_key?: string | null;
  task_id?: string | null;
  client_id?: string;
  client_name?: string | null;
  uploaded_by?: string | null;
  publish_date?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'scheduled' | 'published' | null;
  approval_notes?: string | null;
  mime_type?: string | null;
  preview_url?: string | null;
  thumbnail_url?: string | null;
  web_view_link?: string | null;
  last_synced_at?: string | null;
  source_updated_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  user_id?: string;
  client_id?: string;
  created_at: string;
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
  | 'draft'
  | 'scheduled'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'missed'
  | 'cancelled';

export interface PublishingSchedule {
  id: string;
  asset_id: string;
  client_id?: string | null;
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
  assignee_name?: string | null;
  reminder_minutes?: number | null;
  task_id?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from assets table when fetching schedules */
  asset?: Pick<Asset, 'id' | 'name' | 'content_type' | 'file_url' | 'preview_url' | 'client_name'> | null;
}

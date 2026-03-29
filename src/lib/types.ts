// ============================================================
// OPENY OS – Core Data Models
// ============================================================

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  website?: string;
  status: "active" | "inactive" | "prospect";
  createdAt: string;
  initials: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  clientId?: string;
  assignedTo: string;
  assignee: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  status: "active" | "away" | "offline";
  initials: string;
  color: string;
  createdAt: string;
}

export type ActivityType =
  | "client_added"
  | "client_updated"
  | "client_deleted"
  | "task_completed"
  | "task_created"
  | "member_joined"
  | "member_removed"
  | "report_generated"
  | "invite_sent"
  | "invite_cancelled"
  | "invite_accepted"
  | "invite_expired"
  | "post_approved_by_client"
  | "post_marked_published"
  | "publishing_failed"
  | "client_requested_changes"
  | "post_rescheduled"
  | "approval_submitted"
  | "content_created"
  | "content_status_changed"
  | "publishing_simulated";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  detail: string;
  entityId: string;
  timestamp: string;
}

export type ServiceStatus = "operational" | "degraded" | "down";

export interface SystemStatus {
  name: string;
  latency: string;
  status: ServiceStatus;
}

// ── Notifications ─────────────────────────────────────────────

export type NotificationType =
  | "client_created"
  | "client_updated"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_assigned"
  | "member_invited"
  | "member_added"
  | "invite_accepted"
  | "invite_cancelled"
  | "invite_expired"
  | "status_change"
  | "approval_requested"
  | "approval_received"
  | "content_approved"
  | "content_rejected"
  | "publishing_due_soon"
  | "post_overdue"
  | "quota_warning"
  | "new_client_created"
  | "asset_uploaded"
  | "publishing_failed"
  | "post_published"
  | "client_approved"
  | "client_rejected"
  | "client_requested_changes"
  | "post_rescheduled";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

// ── Content Planner ───────────────────────────────────────────

export type ContentStatus =
  | "idea"
  | "draft"
  | "copywriting"
  | "design"
  | "in_progress"
  | "internal_review"
  | "client_review"
  | "approved"
  | "scheduled"
  | "publishing_ready"
  | "published"
  | "failed"
  | "archived";

export type ContentPlatform =
  | "Facebook"
  | "Instagram"
  | "TikTok"
  | "LinkedIn"
  | "X"
  | "Snapchat"
  | "YouTube";

export type ContentType = "post" | "reel" | "story" | "carousel" | "video" | "ad";

export type ContentPriority = "low" | "medium" | "high";

export type ApprovalStatus =
  | "pending_internal"
  | "pending_client"
  | "approved"
  | "rejected";

export interface ContentComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface ContentItem {
  id: string;
  clientId: string;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  platform: ContentPlatform;
  contentType: ContentType;
  status: ContentStatus;
  priority: ContentPriority;
  assignedTo: string;
  scheduledDate: string;
  scheduledTime: string;
  publishedAt?: string;
  approvalStatus: ApprovalStatus;
  attachments: string[];
  comments: ContentComment[];
  createdAt: string;
  updatedAt: string;
}

// ── Invitations ───────────────────────────────────────────────

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export interface Invitation {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  invitedBy: string;
  invitedByName?: string;
  status: InvitationStatus;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  cancelledAt?: string | null;
}

// ── Approval Workflow ─────────────────────────────────────────

export type ApprovalWorkflowStatus =
  | "pending_internal"
  | "pending_client"
  | "approved"
  | "rejected"
  | "revision_requested";

export interface ApprovalComment {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  userColor: string;
  text: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Approval {
  id: string;
  contentItemId: string;
  clientId: string;
  status: ApprovalWorkflowStatus;
  assignedTo: string;
  internalComments: ApprovalComment[];
  clientComments: ApprovalComment[];
  createdAt: string;
  updatedAt: string;
}

// ── Recurring Content ─────────────────────────────────────────

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "custom";

export interface RecurringContentRule {
  id: string;
  clientId: string;
  titleTemplate: string;
  platform: ContentPlatform;
  contentType: ContentType;
  frequency: RecurringFrequency;
  defaultAssigneeId: string;
  defaultStatus: ContentStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Client Quota ──────────────────────────────────────────────

export interface ClientQuota {
  id: string;
  clientId: string;
  month: string; // "YYYY-MM"
  packageLimit: number;
  usedPosts: number;
  warningThreshold: number; // percentage 0-100
  createdAt: string;
  updatedAt: string;
}

// ── Extended Client Fields ────────────────────────────────────

export interface ClientExtended extends Client {
  companyName?: string;
  industry?: string;
  contactName?: string;
  packageType?: string;
  monthlyPostQuota?: number;
  activePlatforms?: ContentPlatform[];
  toneOfVoice?: string;
  brandColors?: string[];
  brandGuidelines?: string;
  targetAudience?: string;
  goals?: string;
  notesInternal?: string;
  notesClientFacing?: string;
  updatedAt?: string;
}

// ── Assets ───────────────────────────────────────────────────

export type AssetType =
  | "image"
  | "video"
  | "logo"
  | "brand_file"
  | "document"
  | "template"
  | "caption_template"
  | "hashtag_bank"
  | "cta_bank";

export interface Asset {
  id: string;
  clientId: string;
  name: string;
  type: AssetType;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize?: number;
  format?: string;
  tags?: string[];
  folder?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Client Notes ─────────────────────────────────────────────

export type NoteType = "internal" | "client_facing";

export interface ClientNote {
  id: string;
  clientId: string;
  type: NoteType;
  content: string;
  author: string;
  tag?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Bank Entries (Caption / Hashtag / CTA) ────────────────────

export type BankCategory = "caption" | "hashtag" | "cta";

export interface BankEntry {
  id: string;
  clientId: string;
  category: BankCategory;
  text: string;
  tags?: string[];
  platform?: ContentPlatform;
  createdAt: string;
}

// ── Client Activity Timeline ──────────────────────────────────

export type ClientActivityType =
  | "client_created"
  | "post_scheduled"
  | "post_approved"
  | "task_completed"
  | "asset_uploaded"
  | "invitation_accepted"
  | "report_generated"
  | "note_added";

export interface ClientActivity {
  id: string;
  clientId: string;
  type: ClientActivityType;
  message: string;
  detail?: string;
  entityId?: string;
  createdAt: string;
}

// ── Publishing Workflow ───────────────────────────────────────

export type PublishingStatus =
  | "scheduled"
  | "due_now"
  | "published"
  | "failed"
  | "rescheduled";

export type PublishingReadiness =
  | "not_ready"
  | "needs_attention"
  | "ready_to_schedule"
  | "ready_to_publish";

export type FailureReason =
  | "missing_asset"
  | "rejected_by_client"
  | "missed_schedule"
  | "platform_issue"
  | "manual_delay"
  | "other";

export interface PublishingEvent {
  id: string;
  contentItemId: string;
  clientId: string;
  status: PublishingStatus;
  scheduledAt: string;
  publishedAt?: string;
  failedAt?: string;
  rescheduledTo?: string;
  failureReason?: FailureReason;
  failureNote?: string;
  performedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishingFailure {
  id: string;
  contentItemId: string;
  clientId: string;
  reason: FailureReason;
  note?: string;
  reportedBy: string;
  retriedAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ── Notification Preferences ──────────────────────────────────

export interface NotificationChannelPrefs {
  inApp: boolean;
  push: boolean;
  email: boolean;
}

export interface UserNotificationPreferences {
  id: string;
  userId: string;
  approvals: NotificationChannelPrefs;
  publishingReminders: NotificationChannelPrefs;
  taskAlerts: NotificationChannelPrefs;
  invitationEmails: NotificationChannelPrefs;
  systemAlerts: NotificationChannelPrefs;
  clientActions: NotificationChannelPrefs;
  updatedAt: string;
}

// ── Client Portal Session ─────────────────────────────────────

export interface ClientPortalSession {
  id: string;
  clientId: string;
  accessToken: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt?: string;
}


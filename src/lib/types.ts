// ============================================================
// OPENY OS – Core Data Models
// ============================================================

export interface Client {
  id: string;
  name: string;
  company: string;
  // Extended Phase-3 fields (optional to maintain backward compatibility)
  companyName?: string;
  industry?: string;
  contactName?: string;
  email: string;
  phone?: string;
  website?: string;
  status: "active" | "inactive" | "prospect";
  packageType?: string;
  monthlyPostQuota?: number;
  activePlatforms?: string[];
  toneOfVoice?: string;
  brandColors?: string[];
  brandGuidelines?: string;
  targetAudience?: string;
  goals?: string;
  notesInternal?: string;
  notesClientFacing?: string;
  createdAt: string;
  updatedAt?: string;
  initials: string;
  color: string;
  projects: number;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  client: string;
  description: string;
  status: "active" | "completed" | "paused" | "planning" | "review";
  progress: number;
  team: number;
  dueDate: string;
  color: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  project: string;
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
  projects: number;
  createdAt: string;
}

export type ActivityType =
  | "client_added"
  | "client_updated"
  | "client_deleted"
  | "task_completed"
  | "task_created"
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "member_joined"
  | "member_removed"
  | "report_generated"
  | "invite_sent"
  | "invite_cancelled"
  | "invite_accepted"
  | "invite_expired";

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
  | "project_created"
  | "project_updated"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "member_invited"
  | "member_added"
  | "invite_accepted"
  | "invite_cancelled"
  | "invite_expired"
  | "status_change";

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
  | "copywriting"
  | "design"
  | "internal_review"
  | "client_review"
  | "approved"
  | "scheduled"
  | "published";

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
  campaignId?: string;
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

// ── Campaigns ─────────────────────────────────────────────────

export type CampaignStatus = "draft" | "planned" | "active" | "paused" | "completed" | "archived";

export interface Campaign {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  description: string;
  platforms: ContentPlatform[];
  budget: number;
  targetAudience: string;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  ownerId: string;
  linkedContentCount: number;
  linkedTaskCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
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
  campaignId: string;
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

// ── Assets Library ────────────────────────────────────────────

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
  tags: string[];
  folder?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Client Notes ──────────────────────────────────────────────

export type ClientNoteType = "internal" | "client_facing";

export interface ClientNote {
  id: string;
  clientId: string;
  type: ClientNoteType;
  content: string;
  author: string;
  tag?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Caption / Hashtag / CTA Bank ──────────────────────────────

export interface CaptionBankItem {
  id: string;
  clientId?: string;
  text: string;
  tags: string[];
  platform?: ContentPlatform;
  category?: string;
  createdAt: string;
}

export interface HashtagBankItem {
  id: string;
  clientId?: string;
  text: string;
  tags: string[];
  platform?: ContentPlatform;
  category?: string;
  createdAt: string;
}

export interface CTABankItem {
  id: string;
  clientId?: string;
  text: string;
  tags: string[];
  platform?: ContentPlatform;
  category?: string;
  createdAt: string;
}

// ── Client Activity Timeline ──────────────────────────────────

export type ClientActivityType =
  | "client_created"
  | "campaign_created"
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
  timestamp: string;
}

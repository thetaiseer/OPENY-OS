// ============================================================
// OPENY OS – Core Data Models
// ============================================================

// ── Workspace ─────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  companyName: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── User Profile (root-level users/{uid}) ─────────────────────

export type UserRole = "admin" | "account_manager" | "creative" | "reviewer" | "client";
export type UserLanguage = "ar" | "en";
export type UserTheme = "light" | "dark" | "system";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  language: UserLanguage;
  theme: UserTheme;
  createdAt: string;
  updatedAt: string;
}

// ── Client ───────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  /** @deprecated use `name` – kept for backwards-compatibility */
  company?: string;
  slug?: string;
  logoUrl?: string | null;
  industry?: string;
  email: string;
  phone?: string;
  website?: string;
  status: "active" | "inactive" | "prospect" | "archived";
  accountManagerId?: string | null;
  teamMemberIds?: string[];
  monthlyPlanPosts?: number;
  monthlyPlanReels?: number;
  monthlyPlanStories?: number;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  /** @deprecated kept for backwards-compatibility */
  initials?: string;
  /** @deprecated kept for backwards-compatibility */
  color?: string;
}

export interface WorkflowStep {
  /** Position in the workflow (0-indexed) */
  order: number;
  /** Label shown in the UI (e.g. "Copywriting", "Design", "Review") */
  label: string;
  assigneeId: string;
  assigneeName: string;
}

export type TaskType =
  | "content"
  | "design"
  | "video"
  | "report"
  | "meeting"
  | "approval"
  | "other";

export interface TaskRecurrence {
  enabled: boolean;
  type: "monthly" | "weekly" | "custom" | null;
  interval: number | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  type?: TaskType;
  assignedTo: string;
  assignee: string;
  /** ID of the team member from the "team" Firestore collection */
  assigneeId?: string;
  /** Snapshot of the assignee's name at time of assignment (for display even if member is deleted) */
  assigneeName?: string;
  reviewerId?: string | null;
  status: "todo" | "in-progress" | "in_progress" | "review" | "approved" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string;
  scheduledMonth?: number;
  scheduledYear?: number;
  relatedContentId?: string | null;
  recurrence?: TaskRecurrence;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
  createdBy?: string;
  updatedBy?: string;
  /** Optional list of sequential workflow steps. When the task is marked done
   *  and workflowIndex < workflowSteps.length - 1, a new task is created for
   *  the next step automatically. */
  workflowSteps?: WorkflowStep[];
  /** Index of the currently-active step inside workflowSteps (0-indexed). */
  workflowIndex?: number;
  /** ID of the recurring template this task was generated from (if any). */
  recurringTemplateId?: string;
}

// ── Team Roles ───────────────────────────────────────────────

export type TeamRole = "admin" | "account_manager" | "creative" | "reviewer" | "client";
export type TeamDepartment = "content" | "design" | "video" | "accounts" | "management";

export interface MemberPermissions {
  canViewAllClients: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  canManageTeam: boolean;
  canApproveContent: boolean;
  canManageBilling: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  /** Structured role for permission checks */
  teamRole?: TeamRole;
  /** Firebase Auth UID linked to this team member */
  uid?: string;
  email: string;
  avatarUrl?: string | null;
  department?: TeamDepartment;
  assignedClientIds?: string[];
  permissions?: MemberPermissions;
  status: "active" | "away" | "offline";
  isActive?: boolean;
  /** @deprecated kept for backwards-compatibility */
  initials?: string;
  /** @deprecated kept for backwards-compatibility */
  color?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── Recurring Task Templates ──────────────────────────────────

export type RecurringFrequencyTask = "monthly" | "weekly";

export interface RecurringTaskTemplate {
  id: string;
  title: string;
  clientId?: string;
  /** Default assignee for the first step (or only step) */
  assigneeId?: string;
  assigneeName?: string;
  priority: "low" | "medium" | "high";
  frequency: RecurringFrequencyTask;
  /** Optional multi-step workflow defined on the template */
  workflowSteps?: WorkflowStep[];
  /** If true, new tasks are generated automatically */
  isActive: boolean;
  /** ISO date-string of the last generation run */
  lastGeneratedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  | "publishing_simulated"
  | "client_created"
  | "approval_requested"
  | "approval_completed"
  | "asset_uploaded";

export type ActivityEntityType = "client" | "task" | "content" | "approval" | "asset";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  detail: string;
  entityId: string;
  entityType?: ActivityEntityType;
  clientId?: string | null;
  actorId?: string;
  actorName?: string;
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
  | "post_rescheduled"
  | "task"
  | "approval"
  | "system"
  | "invite"
  | "publish_reminder";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** @deprecated use `message` – kept for backwards-compatibility */
  body?: string;
  entityId: string;
  relatedId?: string | null;
  userId?: string;
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

export type ContentSubStatus = "pending" | "in_progress" | "done";
export type ContentPublishStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected";

export interface ContentItem {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  platform: ContentPlatform;
  contentType: ContentType;
  status: ContentStatus;
  publishStatus?: ContentPublishStatus;
  designStatus?: ContentSubStatus;
  captionStatus?: ContentSubStatus;
  priority: ContentPriority;
  assignedTo: string;
  assignedWriterId?: string | null;
  assignedDesignerId?: string | null;
  assignedVideoEditorId?: string | null;
  scheduledDate: string;
  scheduledTime: string;
  publishDate?: string | null;
  publishedAt?: string;
  approvalStatus: ApprovalStatus;
  attachments: string[];
  comments: ContentComment[];
  relatedTaskIds?: string[];
  assetIds?: string[];
  tags?: string[];
  createdBy?: string;
  updatedBy?: string;
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

// ── Client Contracts (subcollection: clients/{id}/contracts) ──

export type ContractStatus = "active" | "expired" | "draft";

export interface Contract {
  id: string;
  clientId: string;
  title: string;
  fileUrl: string;
  storagePath: string;
  startDate: string | null;
  endDate: string | null;
  status: ContractStatus;
  uploadedBy: string;
  createdAt: string;
}

// ── Content Versions (subcollection: content/{id}/versions) ───

export interface ContentVersion {
  id: string;
  contentItemId: string;
  versionNumber: number;
  previewUrl: string;
  storagePath: string;
  uploadedBy: string;
  note: string;
  createdAt: string;
}

// ── Invoice ───────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName?: string;
  invoiceNumber: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  paidAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── Quotation ─────────────────────────────────────────────────

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quotation {
  id: string;
  clientId: string;
  clientName?: string;
  quoteNumber: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: QuotationStatus;
  validUntil: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── Client Contract ───────────────────────────────────────────

export type ClientContractType = "retainer" | "project" | "one_time";
export type ClientContractStatus = "draft" | "active" | "expired" | "terminated";

export interface ClientContract {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  type: ClientContractType;
  startDate: string | null;
  endDate: string | null;
  value?: number;
  currency?: string;
  status: ClientContractStatus;
  fileUrl?: string;
  storagePath?: string;
  signedAt?: string | null;
  signedBy?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── HR Contract ───────────────────────────────────────────────

export type HRContractType = "full_time" | "part_time" | "contract" | "freelance";
export type HRContractStatus = "draft" | "active" | "expired" | "terminated";

export interface HRContract {
  id: string;
  employeeId: string;
  employeeName?: string;
  title: string;
  type: HRContractType;
  startDate: string | null;
  endDate: string | null;
  salary?: number;
  currency?: string;
  status: HRContractStatus;
  fileUrl?: string;
  storagePath?: string;
  signedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── Employee ──────────────────────────────────────────────────

export type EmploymentType = "full_time" | "part_time" | "contract" | "freelance";
export type EmployeeStatus = "active" | "inactive" | "on_leave" | "terminated";

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  department?: TeamDepartment;
  employmentType: EmploymentType;
  salary?: number;
  currency?: string;
  startDate: string;
  endDate?: string | null;
  status: EmployeeStatus;
  avatarUrl?: string | null;
  /** Links to the corresponding TeamMember document */
  teamMemberId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Accounting Entry ──────────────────────────────────────────

export type AccountingEntryType = "income" | "expense" | "invoice" | "payment";

export interface AccountingEntry {
  id: string;
  type: AccountingEntryType;
  category?: string;
  description: string;
  amount: number;
  currency: string;
  /** ID of a related document (e.g. invoiceId, expenseId) */
  referenceId?: string;
  /** Collection name of the referenced document */
  referenceType?: string;
  date: string;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── Expense ───────────────────────────────────────────────────

export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid";

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: ExpenseStatus;
  payee?: string;
  receiptUrl?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  /** Set when the expense is billable to a client */
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ── History Record ────────────────────────────────────────────

export type HistoryAction =
  | "created"
  | "updated"
  | "deleted"
  | "status_changed"
  | "commented"
  | "viewed"
  | "approved"
  | "rejected";

export interface HistoryRecord {
  id: string;
  /** ID of the document this history entry belongs to */
  entityId: string;
  /** Collection / model name (e.g. "invoice", "task", "client") */
  entityType: string;
  action: HistoryAction;
  changedBy: string;
  changedByName?: string;
  /** Serialised previous value (stringified JSON or plain string) */
  previousValue?: string;
  /** Serialised new value (stringified JSON or plain string) */
  newValue?: string;
  note?: string;
  createdAt: string;
}

// ── Calendar Events ───────────────────────────────────────────

export type CalendarEventType = "publish" | "task" | "meeting" | "deadline";

export interface CalendarEvent {
  id: string;
  title: string;
  clientId: string | null;
  type: CalendarEventType;
  relatedId: string | null;
  startAt: string;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}


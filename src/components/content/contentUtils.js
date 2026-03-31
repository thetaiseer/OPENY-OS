"use client";






// ── Platform colours & icons (emoji fallback – no extra deps) ─

export const PLATFORM_COLORS = {
  Facebook:  "#1877f2",
  Instagram: "#e1306c",
  TikTok:    "#010101",
  LinkedIn:  "#0a66c2",
  X:         "#000000",
  Snapchat:  "#fffc00",
  YouTube:   "#ff0000",
};

export const PLATFORM_EMOJIS = {
  Facebook:  "f",
  Instagram: "ig",
  TikTok:    "tt",
  LinkedIn:  "in",
  X:         "𝕏",
  Snapchat:  "👻",
  YouTube:   "▶",
};

// ── Status pipeline ───────────────────────────────────────────

export const STATUS_ORDER = [
  "idea",
  "draft",
  "copywriting",
  "design",
  "in_progress",
  "internal_review",
  "client_review",
  "approved",
  "scheduled",
  "publishing_ready",
  "published",
  "failed",
  "archived",
];

export const STATUS_LABELS = {
  idea:             "content.statusIdea",
  draft:            "content.statusDraft",
  copywriting:      "content.statusCopywriting",
  design:           "content.statusDesign",
  in_progress:      "content.statusInProgress",
  internal_review:  "content.statusInternalReview",
  client_review:    "content.statusClientReview",
  approved:         "content.statusApproved",
  scheduled:        "content.statusScheduled",
  publishing_ready: "content.statusPublishingReady",
  published:        "content.statusPublished",
  failed:           "content.statusFailed",
  archived:         "content.statusArchived",
};

export const STATUS_COLORS = {
  idea:             "#8888a0",
  draft:            "#8888a0",
  copywriting:      "#4f8ef7",
  design:           "#a78bfa",
  in_progress:      "#4f8ef7",
  internal_review:  "#fbbf24",
  client_review:    "#f97316",
  approved:         "#34d399",
  scheduled:        "#06b6d4",
  publishing_ready: "#10b981",
  published:        "#10b981",
  failed:           "#f87171",
  archived:         "#8888a0",
};

// ── Priority ──────────────────────────────────────────────────

export const PRIORITY_COLORS = {
  low:    "#34d399",
  medium: "#fbbf24",
  high:   "#f87171",
};

export const PRIORITY_LABELS = {
  low:    "content.priorityLow",
  medium: "content.priorityMedium",
  high:   "content.priorityHigh",
};

// ── Approval ──────────────────────────────────────────────────

export const APPROVAL_COLORS = {
  pending_internal: "#fbbf24",
  pending_client:   "#f97316",
  approved:         "#34d399",
  rejected:         "#f87171",
};

export const APPROVAL_LABELS = {
  pending_internal: "content.approvalPendingInternal",
  pending_client:   "content.approvalPendingClient",
  approved:         "content.approvalApproved",
  rejected:         "content.approvalRejected",
};

// ── Content type ──────────────────────────────────────────────

export const CONTENT_TYPE_LABELS = {
  post:     "content.typePost",
  reel:     "content.typeReel",
  story:    "content.typeStory",
  carousel: "content.typeCarousel",
  video:    "content.typeVideo",
  ad:       "content.typeAd",
};

// ── Helpers ───────────────────────────────────────────────────

export function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (e) {
    return iso;
  }
}

export function isOverdue(scheduledDate) {
  if (!scheduledDate) return false;
  return new Date(scheduledDate) < new Date(new Date().toDateString());
}

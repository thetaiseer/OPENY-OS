"use client";

// ============================================================
// OPENY OS – Publishing Context (Firestore-backed)
// Phase 4: Publishing Workflow + Simulation
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState } from

"react";







import {
  subscribeToPublishingEvents,
  createPublishingEvent as fsCreatePublishingEvent,
  updatePublishingEvent as fsUpdatePublishingEvent,
  recordPublishingFailure as fsRecordPublishingFailure } from
"./supabase/publishing";
import { createActivity as fsCreateActivity } from "./supabase/activities";

// ── Readiness check helper ────────────────────────────────────

export function computeReadiness(item) {
  const checks = {
    hasTitle: Boolean(item.title?.trim()),
    hasCaption: Boolean(item.caption?.trim()),
    hasPlatform: Boolean(item.platform),
    hasContentType: Boolean(item.contentType),
    hasScheduledDate: Boolean(item.scheduledDate?.trim()),
    hasScheduledTime: Boolean(item.scheduledTime?.trim()),
    hasClient: Boolean(item.clientId?.trim()),
    hasAssignee: Boolean(item.assignedTo?.trim()),
    isApproved: item.approvalStatus === "approved"
  };

  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(Boolean).length;

  if (passedChecks === 0) return "not_ready";
  if (!checks.hasTitle || !checks.hasCaption || !checks.hasPlatform) return "not_ready";
  if (passedChecks < totalChecks - 2) return "needs_attention";
  if (!checks.hasScheduledDate || !checks.hasScheduledTime) return "ready_to_schedule";
  if (!checks.isApproved) return "needs_attention";
  return "ready_to_publish";
}

export function getReadinessChecks(item) {
  return {
    hasTitle: Boolean(item.title?.trim()),
    hasCaption: Boolean(item.caption?.trim()),
    hasPlatform: Boolean(item.platform),
    hasContentType: Boolean(item.contentType),
    hasScheduledDate: Boolean(item.scheduledDate?.trim()),
    hasScheduledTime: Boolean(item.scheduledTime?.trim()),
    hasClient: Boolean(item.clientId?.trim()),
    hasAssignee: Boolean(item.assignedTo?.trim()),
    isApproved: item.approvalStatus === "approved"
  };
}

// ── Context shape ─────────────────────────────────────────────









































const PublishingContext = createContext(null);

// ── Date helpers ──────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function thisWeekEnd() {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  d.setDate(d.getDate() + daysUntilSunday);
  return d.toISOString().split("T")[0];
}

// ── Provider ──────────────────────────────────────────────────

export function PublishingProvider({ children }) {
  const [publishingEvents, setPublishingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToPublishingEvents(
      (rows) => {setPublishingEvents(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // ── Queue helpers ─────────────────────────────────────────

  const getReadinessForItem = useCallback(
    (item) => computeReadiness(item),
    []
  );

  const getPublishingEventForContent = useCallback(
    (contentItemId) =>
    publishingEvents.find((e) => e.contentItemId === contentItemId),
    [publishingEvents]
  );

  const getDueNowItems = useCallback(
    (contentItems) => {
      const today = todayStr();
      const nowHour = new Date().getHours();
      return contentItems.filter((item) => {
        if (item.status === "published" || item.status === "archived") return false;
        if (!item.scheduledDate) return false;
        if (item.scheduledDate !== today) return false;
        if (item.scheduledTime) {
          const timeParts = item.scheduledTime.split(":");
          const scheduledHour = timeParts.length > 0 ? parseInt(timeParts[0], 10) : 0;
          return !isNaN(scheduledHour) && scheduledHour <= nowHour;
        }
        return true;
      });
    },
    []
  );

  const getTodayItems = useCallback(
    (contentItems) => {
      const today = todayStr();
      return contentItems.filter(
        (item) =>
        item.scheduledDate === today &&
        item.status !== "published" &&
        item.status !== "archived"
      );
    },
    []
  );

  const getTomorrowItems = useCallback(
    (contentItems) => {
      const tomorrow = tomorrowStr();
      return contentItems.filter(
        (item) =>
        item.scheduledDate === tomorrow &&
        item.status !== "published" &&
        item.status !== "archived"
      );
    },
    []
  );

  const getThisWeekItems = useCallback(
    (contentItems) => {
      const today = todayStr();
      const weekEnd = thisWeekEnd();
      return contentItems.filter(
        (item) =>
        item.scheduledDate &&
        item.scheduledDate >= today &&
        item.scheduledDate <= weekEnd &&
        item.status !== "published" &&
        item.status !== "archived"
      );
    },
    []
  );

  const getOverdueItems = useCallback(
    (contentItems) => {
      const today = todayStr();
      return contentItems.filter(
        (item) =>
        item.scheduledDate &&
        item.scheduledDate < today &&
        item.status !== "published" &&
        item.status !== "archived" &&
        item.status !== "failed"
      );
    },
    []
  );

  const getFailedItems = useCallback(
    (contentItems) =>
    contentItems.filter((item) => item.status === "failed"),
    []
  );

  const getRecentlyPublished = useCallback(
    (contentItems) => {
      return contentItems.
      filter((item) => item.status === "published" && item.publishedAt).
      sort((a, b) =>
      (b.publishedAt ?? "") > (a.publishedAt ?? "") ? 1 : -1
      ).
      slice(0, 20);
    },
    []
  );

  // ── Actions ───────────────────────────────────────────────

  const createPublishingEvent = useCallback(
    async (
    contentItemId,
    clientId,
    scheduledAt) =>
    {
      const now = new Date().toISOString();
      return fsCreatePublishingEvent({
        contentItemId,
        clientId,
        status: "scheduled",
        scheduledAt,
        createdAt: now,
        updatedAt: now
      });
    },
    []
  );

  const markAsPublished = useCallback(
    async (contentItemId, performedBy) => {
      const now = new Date().toISOString();
      const event = publishingEvents.find(
        (e) => e.contentItemId === contentItemId
      );
      if (event) {
        await fsUpdatePublishingEvent(event.id, {
          status: "published",
          publishedAt: now,
          performedBy
        });
      }
      await fsCreateActivity(
        "post_marked_published",
        "Post marked as published",
        `Content item ${contentItemId} published by ${performedBy}`,
        contentItemId
      );
    },
    [publishingEvents]
  );

  const markAsFailed = useCallback(
    async (
    contentItemId,
    reason,
    note,
    reportedBy) =>
    {
      const now = new Date().toISOString();
      const event = publishingEvents.find(
        (e) => e.contentItemId === contentItemId
      );
      if (event) {
        await fsUpdatePublishingEvent(event.id, {
          status: "failed",
          failedAt: now,
          failureReason: reason,
          failureNote: note,
          performedBy: reportedBy
        });
      }
      await fsRecordPublishingFailure({
        contentItemId,
        clientId: event?.clientId ?? "",
        reason,
        note,
        reportedBy,
        createdAt: now
      });
      await fsCreateActivity(
        "publishing_failed",
        `Publishing failed: ${reason.replace(/_/g, " ")}`,
        note || `Content item ${contentItemId}`,
        contentItemId
      );
    },
    [publishingEvents]
  );

  const rescheduleContent = useCallback(
    async (
    contentItemId,
    newScheduledAt,
    performedBy) =>
    {
      const event = publishingEvents.find(
        (e) => e.contentItemId === contentItemId
      );
      if (event) {
        await fsUpdatePublishingEvent(event.id, {
          status: "rescheduled",
          rescheduledTo: newScheduledAt,
          performedBy
        });
      }
      await fsCreateActivity(
        "post_rescheduled",
        "Post rescheduled",
        `Content item ${contentItemId} rescheduled to ${newScheduledAt}`,
        contentItemId
      );
    },
    [publishingEvents]
  );

  const updatePublishingStatus = useCallback(
    async (eventId, status) => {
      await fsUpdatePublishingEvent(eventId, { status });
    },
    []
  );

  const value = useMemo(
    () => ({
      publishingEvents,
      loading,
      getDueNowItems,
      getTodayItems,
      getTomorrowItems,
      getThisWeekItems,
      getOverdueItems,
      getFailedItems,
      getRecentlyPublished,
      getReadinessForItem,
      getPublishingEventForContent,
      createPublishingEvent,
      markAsPublished,
      markAsFailed,
      rescheduleContent,
      updatePublishingStatus
    }),
    [
    publishingEvents,
    loading,
    getDueNowItems,
    getTodayItems,
    getTomorrowItems,
    getThisWeekItems,
    getOverdueItems,
    getFailedItems,
    getRecentlyPublished,
    getReadinessForItem,
    getPublishingEventForContent,
    createPublishingEvent,
    markAsPublished,
    markAsFailed,
    rescheduleContent,
    updatePublishingStatus]

  );

  return (
    <PublishingContext.Provider value={value}>
      {children}
    </PublishingContext.Provider>);

}

export function usePublishing() {
  const ctx = useContext(PublishingContext);
  if (!ctx)
  throw new Error("usePublishing must be used inside <PublishingProvider>");
  return ctx;
}
"use client";

// ============================================================
// OPENY OS – Publishing Action Bar
// Phase 4: Publishing Workflow – Manual Publish Confirmation
// ============================================================
import { useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { usePublishing } from "@/lib/PublishingContext";
import { useContentItems } from "@/lib/ContentContext";
import { useNotifications } from "@/lib/NotificationContext";
import { FailedPublishingModal } from "@/components/ui/FailedPublishingModal";
import { RescheduleModal } from "@/components/ui/RescheduleModal";






export function PublishingActionBar({ item }) {
  const { markAsPublished, markAsFailed, rescheduleContent } = usePublishing();
  const { updateContentItem } = useContentItems();
  const { pushNotification } = useNotifications();
  const [failedModalOpen, setFailedModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const handleMarkPublished = async () => {
    setPublishing(true);
    try {
      await markAsPublished(item.id, "current_user");
      await updateContentItem(item.id, {
        status: "published",
        publishedAt: new Date().toISOString()
      });
      await pushNotification(
        "post_published",
        "Post Published",
        `"${item.title}" has been published on ${item.platform}`,
        item.id
      );
    } finally {
      setPublishing(false);
    }
  };

  const handleFailed = async (reason, note) => {
    await markAsFailed(item.id, reason, note, "current_user");
    await updateContentItem(item.id, { status: "failed" });
    await pushNotification(
      "publishing_failed",
      "Publishing Failed",
      `"${item.title}" failed to publish: ${reason.replace(/_/g, " ")}`,
      item.id
    );
  };

  const handleReschedule = async (date, time) => {
    const newScheduledAt = time ? `${date}T${time}:00.000Z` : `${date}T09:00:00.000Z`;
    await rescheduleContent(item.id, newScheduledAt, "current_user");
    await updateContentItem(item.id, {
      scheduledDate: date,
      scheduledTime: time,
      status: "scheduled"
    });
  };

  // Only show for scheduled/due content that isn't published/archived
  if (
  item.status === "published" ||
  item.status === "archived" ||
  item.status === "idea" ||
  item.status === "draft" ||
  item.status === "copywriting" ||
  item.status === "design")
  {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleMarkPublished}
          disabled={publishing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-60"
          style={{
            background: "rgba(52,211,153,0.15)",
            color: "#34d399",
            border: "1px solid rgba(52,211,153,0.3)"
          }}>
          
          <CheckCircle2 size={12} />
          {publishing ? "Saving…" : "Mark Published"}
        </button>

        <button
          onClick={() => setFailedModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "rgba(248,113,113,0.1)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.2)"
          }}>
          
          <AlertTriangle size={12} />
          Failed
        </button>

        <button
          onClick={() => setRescheduleModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{
            background: "rgba(167,139,250,0.1)",
            color: "#a78bfa",
            border: "1px solid rgba(167,139,250,0.2)"
          }}>
          
          <RefreshCw size={12} />
          Reschedule
        </button>
      </div>

      <FailedPublishingModal
        open={failedModalOpen}
        onClose={() => setFailedModalOpen(false)}
        onConfirm={handleFailed}
        itemTitle={item.title} />
      

      <RescheduleModal
        open={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        onConfirm={handleReschedule}
        itemTitle={item.title}
        currentDate={item.scheduledDate}
        currentTime={item.scheduledTime} />
      
    </>);

}
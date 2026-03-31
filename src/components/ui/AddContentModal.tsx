"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "./Modal";
import { useContentItems } from "@/lib/ContentContext";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { useToast } from "@/lib/ToastContext";
import type { ContentPlatform, ContentType } from "@/lib/types";

interface AddContentModalProps {
  open: boolean;
  onClose: () => void;
}

const PLATFORMS: ContentPlatform[] = [
  "Instagram",
  "TikTok",
  "Facebook",
  "LinkedIn",
  "X",
  "Snapchat",
  "YouTube",
];

const CONTENT_TYPES: ContentType[] = [
  "post",
  "reel",
  "story",
  "carousel",
  "video",
  "ad",
];

export function AddContentModal({ open, onClose }: AddContentModalProps) {
  const { createContentItem } = useContentItems();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState<ContentPlatform>("Instagram");
  const [contentType, setContentType] = useState<ContentType>("post");
  const [caption, setCaption] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitle("");
    setClientId("");
    setPlatform("Instagram");
    setContentType("post");
    setCaption("");
    setScheduledDate("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(isAr ? "عنوان المحتوى مطلوب" : "Content title is required");
      return;
    }
    if (!clientId) {
      setError(isAr ? "يرجى اختيار عميل" : "Please select a client");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createContentItem({
        title: title.trim(),
        clientId,
        platform,
        contentType,
        caption: caption.trim(),
        scheduledDate: scheduledDate || "",
        status: "idea",
        priority: "medium",
      });
      showToast(isAr ? "تمت إضافة المحتوى بنجاح" : "Content added successfully", "success");
      reset();
      onClose();
    } catch (err) {
      const msg = parseFirestoreError(err, isAr);
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={isAr ? "إضافة محتوى جديد" : "Add new content"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "عنوان المحتوى" : "Content title"}
            <span className="text-[var(--rose)]"> *</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isAr ? "وصف قصير للمحتوى" : "Short content description"}
            required
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </div>

        {/* Client */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "العميل" : "Client"}
            <span className="text-[var(--rose)]"> *</span>
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          >
            <option value="">{isAr ? "— اختر عميلًا —" : "— Select a client —"}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Platform */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "المنصة" : "Platform"}
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className="rounded-2xl border px-3 py-2 text-xs font-medium transition"
                style={{
                  borderColor: platform === p ? "var(--accent)" : "var(--border)",
                  background:
                    platform === p
                      ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                      : "var(--glass-overlay)",
                  color: platform === p ? "var(--accent)" : "var(--muted)",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Content type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "نوع المحتوى" : "Content type"}
          </label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContentType(t)}
                className="rounded-2xl border px-3 py-2 text-xs font-medium transition capitalize"
                style={{
                  borderColor: contentType === t ? "var(--accent)" : "var(--border)",
                  background:
                    contentType === t
                      ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                      : "var(--glass-overlay)",
                  color: contentType === t ? "var(--accent)" : "var(--muted)",
                }}
              >
                {isAr
                  ? t === "post"
                    ? "منشور"
                    : t === "reel"
                    ? "ريل"
                    : t === "story"
                    ? "ستوري"
                    : t === "carousel"
                    ? "كاروسيل"
                    : t === "video"
                    ? "فيديو"
                    : "إعلان"
                  : t}
              </button>
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "الكابشن" : "Caption"}
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={isAr ? "نص المنشور (اختياري)" : "Post copy (optional)"}
            rows={3}
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm resize-none"
          />
        </div>

        {/* Scheduled date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "تاريخ النشر" : "Scheduled date"}
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </div>

        {error ? (
          <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:opacity-80"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Sparkles size={16} />
            {loading
              ? isAr
                ? "جارٍ الإضافة…"
                : "Adding…"
              : isAr
              ? "إضافة محتوى"
              : "Add content"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

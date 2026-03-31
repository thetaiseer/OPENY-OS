"use client";

import { useState, useEffect } from "react";
import { X, Send, ChevronDown, CheckCircle, XCircle, MessageSquare } from "lucide-react";








import {
  STATUS_ORDER,


  APPROVAL_COLORS } from

"./contentUtils";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";









const PLATFORMS = ["Facebook", "Instagram", "TikTok", "LinkedIn", "X", "Snapchat", "YouTube"];
const CONTENT_TYPES = ["post", "reel", "story", "carousel", "video", "ad"];
const PRIORITIES = ["low", "medium", "high"];
const APPROVAL_STATUSES = ["pending_internal", "pending_client", "approved", "rejected"];

// ── Reusable field components ─────────────────────────────────

function Field({
  label,
  required,
  children




}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{required && <span style={{ color: "var(--error)" }}> *</span>}
      </label>
      {children}
    </div>);

}

const inputCls = "w-full rounded-xl px-3 py-2 text-sm outline-none transition-all";
const inputStyle = {
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)"
};

const focusStyle = {
  border: "1px solid var(--accent)"
};

function TextInput({
  value,
  onChange,
  placeholder,
  required,
  type = "text"






}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={inputCls}
      style={{ ...inputStyle, ...(focused ? focusStyle : {}) }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)} />);


}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3





}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={inputCls}
      style={{ ...inputStyle, ...(focused ? focusStyle : {}), resize: "vertical" }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)} />);


}

function SelectInput({
  value,
  onChange,
  children




}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        style={{ ...inputStyle, ...(focused ? focusStyle : {}), appearance: "none", paddingRight: "32px", cursor: "pointer" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}>
        
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
    </div>);

}

// ── Main modal ────────────────────────────────────────────────

export function ContentModal({ open, onClose, item, defaultStatus }) {
  const { t } = useLanguage();
  const { clients, members } = useAppStore();
  const { createContentItem, updateContentItem, addComment } = useContentItems();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtagsRaw, setHashtagsRaw] = useState("");
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState("Instagram");
  const [contentType, setContentType] = useState("post");
  const [status, setStatus] = useState("idea");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("pending_internal");
  const [notes, setNotes] = useState("");

  // Comments
  const [commentText, setCommentText] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("details");

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? "");
      setCaption(item.caption ?? "");
      setHashtagsRaw((item.hashtags ?? []).join(" "));
      setClientId(item.clientId ?? "");
      setPlatform(item.platform);
      setContentType(item.contentType);
      setStatus(item.status);
      setPriority(item.priority);
      setAssignedTo(item.assignedTo ?? "");
      setScheduledDate(item.scheduledDate ?? "");
      setScheduledTime(item.scheduledTime ?? "");
      setApprovalStatus(item.approvalStatus);
      setNotes(item.description ?? "");
    } else {
      setTitle("");
      setDescription("");
      setCaption("");
      setHashtagsRaw("");
      setClientId("");
      setPlatform("Instagram");
      setContentType("post");
      setStatus(defaultStatus ?? "idea");
      setPriority("medium");
      setAssignedTo("");
      setScheduledDate("");
      setScheduledTime("");
      setApprovalStatus("pending_internal");
      setNotes("");
    }
    setError("");
    setActiveTab("details");
  }, [open, item, defaultStatus]);

  const handleSave = async (closeAfter = true) => {
    if (!title.trim()) {setError("Title is required.");return;}
    setSaving(true);
    setError("");
    try {
      const data = {
        clientId,
        title: title.trim(),
        description,
        caption,
        hashtags: hashtagsRaw.split(/\s+/).filter(Boolean),
        platform,
        contentType,
        status,
        priority,
        assignedTo,
        scheduledDate,
        scheduledTime,
        approvalStatus,
        attachments: []
      };
      if (item) {
        await updateContentItem(item.id, { ...data });
      } else {
        await createContentItem(data);
      }
      if (closeAfter) onClose();
    } catch (e) {
      setError("Something went wrong. Please try again.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAction = async (newApproval) => {
    if (!item) return;
    await updateContentItem(item.id, { approvalStatus: newApproval });
    setApprovalStatus(newApproval);
  };

  const handlePostComment = async () => {
    if (!item || !commentText.trim()) return;
    await addComment(item.id, {
      userId: "current_user",
      userName: "You",
      text: commentText.trim(),
      createdAt: new Date().toISOString()
    });
    setCommentText("");
  };

  if (!open) return null;

  const tabStyle = (active) => ({
    padding: "6px 14px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    background: active ? "var(--surface-1)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    border: "none",
    outline: "none",
    transition: "all 0.15s"
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-modal flex flex-col overflow-hidden"
        style={{
          width: "min(92vw, 680px)",
          maxHeight: "min(88vh, 820px)"
        }}
        onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            {item ? t("content.modalEditTitle") : t("content.modalCreateTitle")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}>
            
            <X size={16} />
          </button>
        </div>

        {/* Tabs (only in edit mode) */}
        {item &&
        <div className="px-6 pt-4 pb-0 flex-shrink-0">
            <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--surface-3)" }}>
              {["details", "approval", "comments"].map((tab) =>
            <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            )}
            </div>
          </div>
        }

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* ── DETAILS TAB ── */}
          {(activeTab === "details" || !item) &&
          <>
              {/* Row: Title */}
              <Field label={t("content.titleLabel")} required>
                <TextInput value={title} onChange={setTitle} placeholder={t("content.titlePlaceholder")} required />
              </Field>

              {/* Row: Client */}
              <div className="grid grid-cols-1 gap-3">
                <Field label={t("content.clientLabel")}>
                  <SelectInput value={clientId} onChange={setClientId}>
                    <option value="">— Select client —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </SelectInput>
                </Field>
              </div>

              {/* Row: Platform + Content Type */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("content.platformLabel")}>
                  <SelectInput value={platform} onChange={(v) => setPlatform(v)}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </SelectInput>
                </Field>
                <Field label={t("content.contentTypeLabel")}>
                  <SelectInput value={contentType} onChange={(v) => setContentType(v)}>
                    {CONTENT_TYPES.map((ct) =>
                  <option key={ct} value={ct}>
                        {t("content.type" + ct.charAt(0).toUpperCase() + ct.slice(1))}
                      </option>
                  )}
                  </SelectInput>
                </Field>
              </div>

              {/* Caption */}
              <Field label={t("content.captionLabel")}>
                <Textarea value={caption} onChange={setCaption} placeholder={t("content.captionPlaceholder")} rows={3} />
              </Field>

              {/* Hashtags */}
              <Field label={t("content.hashtagsLabel")}>
                <TextInput value={hashtagsRaw} onChange={setHashtagsRaw} placeholder={t("content.hashtagsPlaceholder")} />
              </Field>

              {/* Row: Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("content.statusLabel")}>
                  <SelectInput value={status} onChange={(v) => setStatus(v)}>
                    {STATUS_ORDER.map((s) =>
                  <option key={s} value={s}>
                        {t("content.status" + s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(""))}
                      </option>
                  )}
                  </SelectInput>
                </Field>
                <Field label={t("content.priorityLabel")}>
                  <SelectInput value={priority} onChange={(v) => setPriority(v)}>
                    {PRIORITIES.map((p) =>
                  <option key={p} value={p}>
                        {t("content.priority" + p.charAt(0).toUpperCase() + p.slice(1))}
                      </option>
                  )}
                  </SelectInput>
                </Field>
              </div>

              {/* Row: Assignee */}
              <Field label={t("content.assigneeLabel")}>
                <SelectInput value={assignedTo} onChange={setAssignedTo}>
                  <option value="">— {t("content.assigneePlaceholder")} —</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </SelectInput>
              </Field>

              {/* Row: Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("content.scheduledDateLabel")}>
                  <TextInput type="date" value={scheduledDate} onChange={setScheduledDate} />
                </Field>
                <Field label={t("content.scheduledTimeLabel")}>
                  <TextInput type="time" value={scheduledTime} onChange={setScheduledTime} />
                </Field>
              </div>

              {/* Notes */}
              <Field label={t("content.notesLabel")}>
                <Textarea value={notes} onChange={setNotes} placeholder={t("content.notesPlaceholder")} rows={2} />
              </Field>
            </>
          }

          {/* ── APPROVAL TAB ── */}
          {activeTab === "approval" && item &&
          <div className="space-y-4">
              {/* Current approval status */}
              <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{
                background: APPROVAL_COLORS[approvalStatus] + "15",
                border: `1px solid ${APPROVAL_COLORS[approvalStatus]}33`
              }}>
              
                <div className="w-3 h-3 rounded-full" style={{ background: APPROVAL_COLORS[approvalStatus] }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {t("content.approval" + approvalStatus.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(""))}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t("content.approvalLabel")}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <button
                onClick={() => handleApprovalAction("approved")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "#34d39922", color: "#34d399", border: "1px solid #34d39944" }}>
                
                  <CheckCircle size={15} />
                  {t("content.approve")}
                </button>
                <button
                onClick={() => handleApprovalAction("rejected")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "#f8717122", color: "#f87171", border: "1px solid #f8717144" }}>
                
                  <XCircle size={15} />
                  {t("content.reject")}
                </button>
                <button
                onClick={() => handleApprovalAction("pending_client")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: "var(--surface-3)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                
                  {t("content.requestChanges")}
                </button>
              </div>

              {/* Approval status changer */}
              <Field label={t("content.approvalLabel")}>
                <SelectInput value={approvalStatus} onChange={(v) => {
                setApprovalStatus(v);
                handleApprovalAction(v);
              }}>
                  {APPROVAL_STATUSES.map((a) =>
                <option key={a} value={a}>
                      {t("content.approval" + a.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(""))}
                    </option>
                )}
                </SelectInput>
              </Field>
            </div>
          }

          {/* ── COMMENTS TAB ── */}
          {activeTab === "comments" && item &&
          <div className="space-y-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                <MessageSquare size={14} className="inline mr-1" />
                {t("content.commentsTitle")}
              </p>

              {/* Comment list */}
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {(item.comments ?? []).length === 0 ?
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                    {t("content.noComments")}
                  </p> :

              item.comments.map((c) =>
              <div
                key={c.id}
                className="flex gap-3 p-3 rounded-xl"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                
                      <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: "var(--accent)" }}>
                  
                        {c.userName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{c.userName}</span>
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.text}</p>
                      </div>
                    </div>
              )
              }
              </div>

              {/* Add comment */}
              <div className="flex gap-2">
                <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t("content.addCommentPlaceholder")}
                className={inputCls + " flex-1"}
                style={inputStyle}
                onKeyDown={(e) => {if (e.key === "Enter") handlePostComment();}} />
              
                <button
                onClick={handlePostComment}
                disabled={!commentText.trim()}
                className="px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all"
                style={{
                  background: commentText.trim() ? "var(--accent)" : "var(--surface-3)",
                  color: commentText.trim() ? "white" : "var(--text-muted)"
                }}>
                
                  <Send size={13} />
                  {t("content.postComment")}
                </button>
              </div>
            </div>
          }

          {/* Error */}
          {error &&
          <p className="text-xs" style={{ color: "var(--error)" }}>{error}</p>
          }
        </div>

        {/* Footer */}
        {(activeTab === "details" || !item) &&
        <div
          className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}>
          
            <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            
              {t("common.cancel")}
            </button>
            {item &&
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            
                {saving ? t("common.loading") : "Save & Continue"}
              </button>
          }
            <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "var(--accent)", color: "white" }}>
            
              {saving ? t("common.loading") : item ? t("content.saveBtn") : t("content.createBtn")}
            </button>
          </div>
        }
      </div>
    </div>);

}
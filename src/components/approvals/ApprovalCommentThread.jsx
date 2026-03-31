"use client";

import { useState } from "react";
import { Send } from "lucide-react";

import { useLanguage } from "@/lib/LanguageContext";










function relativeTime(iso, t) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("common.justNow");
  if (mins < 60) return `${mins}${t("common.minAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("common.hrAgo")}`;
  return `${Math.floor(hrs / 24)}${t("common.dayAgo")}`;
}

export function ApprovalCommentThread({
  comments,
  onAdd,
  currentUserName,
  currentUserInitials,
  currentUserColor,
  title
}) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [focused, setFocused] = useState(false);const handleSubmit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), isInternal);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{title}</p>

      {/* Comment list */}
      {comments.length === 0 ?
      <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
          {t("approvals.addComment")}
        </p> :

      <div className="space-y-3 mb-4">
          {comments.map((c) =>
        <div key={c.id} className="flex items-start gap-3">
              <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: c.userColor || "var(--accent)" }}>
            
                {c.userInitials || c.userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {c.userName}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {relativeTime(c.createdAt, t)}
                  </span>
                  {!c.isInternal &&
              <span
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "#f59e0b20", color: "#f59e0b" }}>
                
                      client
                    </span>
              }
                </div>
                <p
              className="text-xs mt-1 leading-relaxed"
              style={{ color: "var(--text-secondary)" }}>
              
                  {c.text}
                </p>
              </div>
            </div>
        )}
        </div>
      }

      {/* Input area */}
      <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        {/* Internal / Client toggle */}
        <div className="flex gap-1 mb-2 p-1 rounded-lg w-fit" style={{ background: "var(--surface-3)" }}>
          {[
          { val: true, label: t("approvals.internalComments") },
          { val: false, label: t("approvals.clientComments") }].
          map(({ val, label }) =>
          <button
            key={String(val)}
            onClick={() => setIsInternal(val)}
            className="px-3 py-1 rounded-md text-[11px] font-medium transition-all"
            style={{
              background: isInternal === val ? "var(--surface-1)" : "transparent",
              color: isInternal === val ? "var(--text-primary)" : "var(--text-muted)"
            }}>
            
              {label}
            </button>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            style={{ background: currentUserColor || "var(--accent)" }}>
            
            {currentUserInitials || currentUserName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("approvals.addComment")}
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-xs outline-none transition-all resize-none"
              style={{
                background: "var(--surface-3)",
                border: focused ? "1px solid var(--accent)" : "1px solid var(--border)",
                color: "var(--text-primary)"
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)} />
            
          </div>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
            style={{
              background: text.trim() ? "var(--accent)" : "var(--surface-3)",
              color: text.trim() ? "white" : "var(--text-muted)"
            }}>
            
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>);

}
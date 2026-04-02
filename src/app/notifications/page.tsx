"use client";

import { useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "@/lib/NotificationContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  EmptyPanel,
  PageHeader,
  PageMotion,
  Panel,
  pageText,
} from "@/components/redesign/ui";

type FilterType = "all" | "unread" | "read";

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, unreadCount } =
    useNotifications();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const FILTER_TABS: { value: FilterType; labelEn: string; labelAr: string }[] = [
    { value: "all",    labelEn: "All",    labelAr: "الكل"       },
    { value: "unread", labelEn: "Unread", labelAr: "غير مقروء"  },
    { value: "read",   labelEn: "Read",   labelAr: "مقروء"      },
  ];

  const formatTime = (ts: number | string | undefined) => {
    if (!ts) return "";
    try {
      return new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ts));
    } catch {
      return "";
    }
  };

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Alerts & updates", "التنبيهات والتحديثات")}
        title={pageText("Notifications", "الإشعارات")}
        description={pageText(
          "Stay up to date with activity across your workspace.",
          "ابقَ على اطلاع بالنشاط في مساحة عملك."
        )}
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllAsRead}
              className="btn btn-secondary"
              style={{ fontSize: 13 }}
            >
              <CheckCheck size={15} />
              {isAr ? "تحديد الكل كمقروء" : "Mark all as read"}
            </button>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            style={{
              borderRadius: 999,
              padding: "6px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
              background: filter === tab.value ? "var(--accent)" : "var(--surface-2)",
              color: filter === tab.value ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${filter === tab.value ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {isAr ? tab.labelAr : tab.labelEn}
            {tab.value === "unread" && unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: filter === "unread" ? "rgba(255,255,255,0.3)" : "var(--accent-soft)",
                  color: filter === "unread" ? "#fff" : "var(--accent-text)",
                  borderRadius: 999,
                  padding: "1px 6px",
                  fontSize: 11,
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <Panel>
        {filtered.length === 0 ? (
          <EmptyPanel
            icon={Bell}
            title={pageText("No notifications", "لا توجد إشعارات")}
            description={pageText(
              filter === "unread"
                ? "You've read everything. Great job!"
                : "Nothing to show here.",
              filter === "unread" ? "لقد قرأت كل شيء. عمل رائع!" : "لا يوجد شيء للعرض."
            )}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.map((n, idx) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 0",
                  borderBottom:
                    idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  cursor: !n.read ? "pointer" : "default",
                  transition: "background 0.12s",
                }}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                {/* Unread indicator */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: !n.read ? "var(--accent)" : "transparent",
                    flexShrink: 0,
                    marginTop: 6,
                    border: n.read ? "1px solid var(--border)" : "none",
                  }}
                />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: !n.read ? 600 : 400,
                      color: "var(--text)",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        margin: "3px 0 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {n.body}
                    </p>
                  )}
                  {n.createdAt && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                      {formatTime(n.createdAt as string | number | undefined)}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      title={isAr ? "تحديد كمقروء" : "Mark as read"}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "transparent",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <CheckCheck size={13} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                    title={isAr ? "حذف" : "Delete"}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: "transparent",
                      border: "1px solid transparent",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--danger-soft)";
                      (e.currentTarget as HTMLElement).style.color = "var(--danger)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(220,38,38,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}

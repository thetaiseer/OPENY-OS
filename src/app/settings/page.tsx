"use client";

import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";
import { BellRing, Globe, Moon, Sun, Check } from "lucide-react";
import {
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  pageText,
} from "@/components/redesign/ui";

const NOTIFICATION_CATEGORIES = [
  {
    key: "approvals",
    title: { en: "Approvals", ar: "الموافقات" },
    description: { en: "Review and client decision updates", ar: "تحديثات المراجعة وقرارات العميل" },
  },
  {
    key: "publishingReminders",
    title: { en: "Publishing reminders", ar: "تذكيرات النشر" },
    description: { en: "Launch windows and publishing timing", ar: "نوافذ الإطلاق وتوقيت النشر" },
  },
  {
    key: "taskAlerts",
    title: { en: "Task alerts", ar: "تنبيهات المهام" },
    description: { en: "Assignments and task completion nudges", ar: "إشعارات التعيين وتذكيرات إكمال المهام" },
  },
  {
    key: "invitationEmails",
    title: { en: "Invitations", ar: "الدعوات" },
    description: { en: "Invite flow and acceptance events", ar: "أحداث الدعوات والقبول" },
  },
  {
    key: "systemAlerts",
    title: { en: "System alerts", ar: "تنبيهات النظام" },
    description: { en: "Workspace health and service signals", ar: "صحة مساحة العمل وإشارات الخدمة" },
  },
  {
    key: "clientActions",
    title: { en: "Client actions", ar: "إجراءات العميل" },
    description: { en: "Client approvals, changes, and follow-ups", ar: "موافقات العميل والتعديلات والمتابعات" },
  },
];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { prefs, loading, updateCategory } = useNotificationPreferences();
  const isArabic = language === "ar";

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Account & system", "الحساب والنظام")}
        title={pageText("Settings", "الإعدادات")}
        description={pageText(
          "Manage your profile, security, notifications, and interface preferences.",
          "إدارة ملفك الشخصي والأمان والإشعارات وتفضيلات الواجهة."
        )}
      />

      {/* Appearance */}
      <Panel
        title={pageText("Appearance", "المظهر")}
        description={pageText("Customize the look and feel of the interface.", "تخصيص مظهر الواجهة وشكلها.")}
        style={{ marginBottom: 20 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Theme */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "var(--surface-2)",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {theme === "dark" ? (
                <Moon size={18} style={{ color: "var(--accent)" }} />
              ) : (
                <Sun size={18} style={{ color: "var(--warning)" }} />
              )}
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                  {isArabic ? "السمة" : "Theme"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  {theme === "dark"
                    ? (isArabic ? "الوضع الداكن مفعّل" : "Dark mode is active")
                    : (isArabic ? "الوضع الفاتح مفعّل" : "Light mode is active")}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ fontSize: 12 }}
            >
              {theme === "dark"
                ? (isArabic ? "التبديل إلى الفاتح" : "Switch to light")
                : (isArabic ? "التبديل إلى الداكن" : "Switch to dark")}
            </button>
          </div>

          {/* Language */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "var(--surface-2)",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Globe size={18} style={{ color: "var(--accent)" }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                  {isArabic ? "اللغة" : "Language"}
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  {language === "ar" ? "العربية" : "English"}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["en", "ar"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    borderRadius: 8,
                    padding: "6px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: language === lang ? "var(--accent)" : "var(--surface)",
                    color: language === lang ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${language === lang ? "var(--accent)" : "var(--border-strong)"}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {language === lang && <Check size={12} />}
                  {lang === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Notifications */}
      <Panel
        title={pageText("Notifications", "الإشعارات")}
        description={pageText(
          "Control which notification types you receive.",
          "تحكم في أنواع الإشعارات التي تتلقاها."
        )}
        action={
          <InfoBadge
            label={isArabic ? "في الوقت الفعلي" : "Real-time"}
            tone="blue"
          />
        }
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{ height: 56, borderRadius: 10 }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {NOTIFICATION_CATEGORIES.map(({ key, title, description }) => {
              const catPrefs = prefs?.[key as string] as Record<string, boolean> | undefined;
              const enabled = catPrefs?.inApp ?? true;
              return (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "14px 16px",
                    background: "var(--surface-2)",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <BellRing
                      size={16}
                      style={{ color: enabled ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}
                    />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                        {isArabic ? title.ar : title.en}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                        {isArabic ? description.ar : description.en}
                      </p>
                    </div>
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => updateCategory(key, "inApp", !enabled)}
                    aria-label={`Toggle ${title.en}`}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      background: enabled ? "var(--accent)" : "var(--border-strong)",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 3,
                        left: enabled ? 23 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}

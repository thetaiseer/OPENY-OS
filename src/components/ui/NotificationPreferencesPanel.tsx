"use client";

// ============================================================
// OPENY OS – Notification Preferences Panel
// Phase 4: Advanced Notifications
// ============================================================
import { Bell } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import type { UserNotificationPreferences, NotificationChannelPrefs } from "@/lib/types";

type PrefCategory = keyof Omit<UserNotificationPreferences, "id" | "userId" | "updatedAt">;

const CATEGORIES: { key: PrefCategory; label: string; description: string }[] = [
  {
    key: "approvals",
    label: "Approvals",
    description: "Approval requests, reviews and decisions",
  },
  {
    key: "publishingReminders",
    label: "Publishing Reminders",
    description: "Due soon, overdue, failed publishing",
  },
  {
    key: "taskAlerts",
    label: "Task Alerts",
    description: "New tasks assigned and completions",
  },
  {
    key: "campaignAlerts",
    label: "Campaign Alerts",
    description: "Campaign start / end and status changes",
  },
  {
    key: "invitationEmails",
    label: "Invitations",
    description: "Team invitation sent and accepted",
  },
  {
    key: "systemAlerts",
    label: "System Alerts",
    description: "Quota warnings and system status",
  },
  {
    key: "clientActions",
    label: "Client Actions",
    description: "Client approval, rejection, and changes",
  },
];

const CHANNELS: { key: keyof NotificationChannelPrefs; label: string }[] = [
  { key: "inApp", label: "In-App" },
  { key: "push", label: "Push" },
  { key: "email", label: "Email" },
];

export function NotificationPreferencesPanel() {
  const { prefs, loading, updateCategory } = useNotificationPreferences();

  if (loading) {
    return (
      <div
        className="text-sm py-6 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        Loading preferences…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--accent-dim)" }}
        >
          <Bell size={16} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Notification Preferences
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Choose how you receive each type of notification
          </p>
        </div>
      </div>

      {/* Channel header */}
      <div
        className="grid gap-2 text-[10px] font-semibold uppercase tracking-wide px-1"
        style={{
          gridTemplateColumns: "1fr 60px 60px 60px",
          color: "var(--text-muted)",
        }}
      >
        <span>Category</span>
        {CHANNELS.map((ch) => (
          <span key={ch.key} className="text-center">
            {ch.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      {CATEGORIES.map((cat) => {
        const catPrefs = prefs[cat.key] as NotificationChannelPrefs;
        return (
          <Card key={cat.key} padding="sm">
            <div
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: "1fr 60px 60px 60px" }}
            >
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {cat.label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {cat.description}
                </p>
              </div>
              {CHANNELS.map((ch) => (
                <div key={ch.key} className="flex justify-center">
                  <Toggle
                    checked={catPrefs[ch.key]}
                    onChange={(v) => updateCategory(cat.key, ch.key, v)}
                  />
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

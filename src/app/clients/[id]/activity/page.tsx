"use client";

import {
  Activity, FileText, ImageIcon, Trash2, Edit, Plus, CheckCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useClients, useActivities } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { EmptyPanel, InfoBadge, PageMotion, Panel, pageText } from "@/components/redesign/ui";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  task_added:      Plus,
  task_updated:    Edit,
  task_deleted:    Trash2,
  task_done:       CheckCircle,
  content_added:   FileText,
  content_updated: Edit,
  content_deleted: Trash2,
  asset_uploaded:  ImageIcon,
  asset_deleted:   Trash2,
  client_added:    Plus,
  client_updated:  Edit,
};

const ACTIVITY_COLORS: Record<string, string> = {
  task_added:      "#3b82f6",
  task_done:       "#10b981",
  task_deleted:    "#ef4444",
  content_added:   "#8b5cf6",
  content_deleted: "#ef4444",
  asset_uploaded:  "#06b6d4",
  asset_deleted:   "#ef4444",
  client_added:    "#10b981",
  client_updated:  "#f59e0b",
};

export default function ClientActivityPage() {
  const params = useParams();
  const { clients } = useClients();
  const { activities } = useActivities();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const client = clients.find((c) => c.id === params.id);

  // Show recent workspace activities (all belong to the same workspace)
  const recentActivities = activities.slice(0, 50);

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("", "")} />
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <Panel
        title={pageText("Activity log", "سجل النشاط")}
        description={pageText(
          "Recent operations in this workspace.",
          "العمليات الحديثة في مساحة العمل."
        )}
        action={
          <InfoBadge
            label={isArabic ? `${recentActivities.length} حدث` : `${recentActivities.length} events`}
            tone="blue"
          />
        }
      >
        {recentActivities.length === 0 ? (
          <EmptyPanel
            title={pageText("No activity yet", "لا يوجد نشاط بعد")}
            description={pageText(
              "All actions performed in this workspace will be logged here.",
              "كل العمليات المنفذة في مساحة العمل ستُسجل هنا."
            )}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentActivities.map((activity, index) => {
              const Icon  = ACTIVITY_ICONS[activity.type] ?? Activity;
              const color = ACTIVITY_COLORS[activity.type] ?? "var(--text-muted)";
              const isLast = index === recentActivities.length - 1;
              return (
                <div
                  key={activity.id}
                  style={{
                    display: "flex", gap: 14,
                    paddingBottom: isLast ? 0 : 14,
                    borderBottom: isLast ? "none" : "1px solid var(--border)",
                    marginBottom: isLast ? 0 : 14,
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: `${color}18`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", margin: 0 }}>
                      {activity.message}
                    </p>
                    {activity.detail && (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                        {activity.detail}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {new Date(activity.timestamp).toLocaleString(isArabic ? "ar-EG" : "en-US")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}

"use client";

import { Clock, Plus, CheckCircle2, FileText, Megaphone, Upload, Bell, StickyNote } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { ClientActivity } from "@/lib/types";

const iconMap: Record<ClientActivity["type"], typeof Clock> = {
  client_created: CheckCircle2,
  campaign_created: Megaphone,
  post_scheduled: Clock,
  post_approved: CheckCircle2,
  task_completed: CheckCircle2,
  asset_uploaded: Upload,
  invitation_accepted: Bell,
  report_generated: FileText,
  note_added: StickyNote,
};

const colorMap: Record<ClientActivity["type"], string> = {
  client_created: "var(--accent)",
  campaign_created: "#a78bfa",
  post_scheduled: "#fbbf24",
  post_approved: "var(--success, #34d399)",
  task_completed: "var(--success, #34d399)",
  asset_uploaded: "#4f8ef7",
  invitation_accepted: "#34d399",
  report_generated: "#8888a0",
  note_added: "#fbbf24",
};

function timeAgo(ts: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("common.justNow");
  if (mins < 60) return `${mins}${t("common.minAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("common.hrAgo")}`;
  return `${Math.floor(hrs / 24)}${t("common.dayAgo")}`;
}

interface ClientTimelineProps {
  activities: ClientActivity[];
}

export function ClientTimeline({ activities }: ClientTimelineProps) {
  const { t } = useLanguage();

  if (activities.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 rounded-2xl"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <Clock size={32} style={{ color: "var(--text-muted)" }} />
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("workspace.noTimeline")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((item, idx) => {
        const Icon = iconMap[item.type] ?? Clock;
        const color = colorMap[item.type] ?? "var(--text-muted)";
        const isLast = idx === activities.length - 1;

        return (
          <div key={item.id} className="flex gap-3">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}22`, border: `1.5px solid ${color}` }}
              >
                <Icon size={14} color={color} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 mt-1" style={{ background: "var(--border)", minHeight: "20px" }} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 min-w-0 flex-1 ${isLast ? "" : ""}`}>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {item.message}
              </p>
              {item.detail && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {item.detail}
                </p>
              )}
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {timeAgo(item.timestamp, t)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

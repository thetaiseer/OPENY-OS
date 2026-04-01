"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useClients } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ContentCalendar } from "@/components/content/ContentCalendar";
import { ContentModal } from "@/components/content/ContentModal";
import { AddContentModal } from "@/components/ui/AddContentModal";
import { EmptyPanel, InfoBadge, PageMotion, Panel, pageText } from "@/components/redesign/ui";

const STATUS_COLORS = {
  draft:          { bg: "rgba(100,116,139,0.12)", color: "#64748b" },
  idea:           { bg: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  copywriting:    { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  design:         { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  in_progress:    { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  internal_review:{ bg: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  client_review:  { bg: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
  approved:       { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
  scheduled:      { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  publishing_ready:{ bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  published:      { bg: "rgba(16,185,129,0.15)",  color: "#059669" },
};

const VIEW_MODES = [
  { id: "calendar", labelEn: "Calendar", labelAr: "التقويم" },
  { id: "list",     labelEn: "List",     labelAr: "القائمة" },
];

export default function ClientContentPage() {
  const params = useParams();
  const { clients } = useClients();
  const { contentItems } = useContentItems();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [view, setView]                 = useState<"calendar" | "list">("calendar");
  const [selectedItem, setSelectedItem] = useState(null);
  const [showAdd, setShowAdd]           = useState(false);

  const client        = clients.find((c) => c.id === params.id);
  const clientContent = contentItems.filter((i) => i.clientId === params.id);
  const scheduled     = clientContent.filter((i) => i.scheduledDate).length;
  const published     = clientContent.filter((i) => i.status === "published").length;

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("", "")} />
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      {selectedItem && (
        <ContentModal open={true} item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
      <AddContentModal open={showAdd} onClose={() => setShowAdd(false)} defaultClientId={params.id as string} />

      <Panel
        title={pageText("Content plan", "خطة المحتوى")}
        description={pageText(
          "All scheduled and published content for this client.",
          "جميع المحتوى المجدول والمنشور لهذا العميل."
        )}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InfoBadge label={isArabic ? `${scheduled} مجدول` : `${scheduled} scheduled`} tone="violet" />
            <InfoBadge label={isArabic ? `${published} منشور` : `${published} published`} tone="mint" />
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                color: "white", borderRadius: 10, padding: "7px 14px",
                fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              }}
            >
              <Plus size={13} />
              {isArabic ? "محتوى جديد" : "New content"}
            </button>
          </div>
        }
      >
        {/* View mode toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {VIEW_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setView(m.id as "calendar" | "list")}
              style={{
                borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 500,
                cursor: "pointer", border: "1px solid",
                borderColor: view === m.id ? "var(--accent)" : "var(--border)",
                background: view === m.id ? "var(--accent)" : "var(--glass-overlay)",
                color: view === m.id ? "white" : "var(--text-muted)",
              }}
            >
              {isArabic ? m.labelAr : m.labelEn}
            </button>
          ))}
        </div>

        {clientContent.length === 0 ? (
          <EmptyPanel
            title={pageText("No content yet", "لا يوجد محتوى بعد")}
            description={pageText(
              "Add content items to see the monthly publish plan.",
              "أضف عناصر محتوى لرؤية خطة النشر الشهرية."
            )}
          />
        ) : view === "calendar" ? (
          <ContentCalendar items={clientContent} onItemClick={(item) => setSelectedItem(item)} />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {clientContent.map((item) => {
              const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft;
              return (
                <article
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    borderRadius: 12, border: "1px solid var(--border)",
                    background: "var(--panel)", padding: "12px 16px",
                    cursor: "pointer", transition: "box-shadow 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                    {item.platform && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0" }}>{item.platform}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {item.scheduledDate && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.scheduledDate}</span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: sc.bg, color: sc.color }}>
                      {item.status}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}

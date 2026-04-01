"use client";

import { useParams } from "next/navigation";
import { useClients, useTeam } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { EmptyPanel, InfoBadge, PageMotion, Panel, pageText } from "@/components/redesign/ui";

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:           { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  account_manager: { bg: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  creative:        { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
  away:   { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  busy:   { bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
};

export default function ClientTeamPage() {
  const params = useParams();
  const { clients } = useClients();
  const { members } = useTeam();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const client = clients.find((c) => c.id === params.id);

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("", "")} />
      </PageMotion>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <PageMotion>
      <Panel
        title={pageText("Workspace team", "فريق مساحة العمل")}
        description={pageText(
          "All team members who can work on this client account.",
          "جميع أعضاء الفريق الذين يمكنهم العمل على حساب هذا العميل."
        )}
        action={
          <InfoBadge
            label={isArabic ? `${members.length} عضو` : `${members.length} members`}
            tone="blue"
          />
        }
      >
        {members.length === 0 ? (
          <EmptyPanel
            title={pageText("No team members yet", "لا يوجد أعضاء فريق بعد")}
            description={pageText(
              "Team members added to the workspace will appear here.",
              "أعضاء الفريق المضافون إلى مساحة العمل سيظهرون هنا."
            )}
          />
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {members.map((member) => {
              const initials = (member.name || "?")
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const rc = ROLE_COLORS[member.teamRole ?? member.role] ?? ROLE_COLORS.creative;
              const sc = STATUS_COLORS[member.status] ?? STATUS_COLORS.active;
              return (
                <article
                  key={member.id}
                  style={{
                    borderRadius: 14, border: "1px solid var(--border)",
                    background: "var(--panel)", padding: "14px 16px",
                    boxShadow: "var(--shadow-xs)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "white",
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {member.name}
                    </p>
                    {member.email && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {member.email}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 20, padding: "2px 8px", background: rc.bg, color: rc.color }}>
                      {member.teamRole ?? member.role ?? (isArabic ? "مبدع" : "creative")}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 20, padding: "2px 8px", background: sc.bg, color: sc.color }}>
                      {isArabic
                        ? member.status === "active" ? "نشط" : member.status === "away" ? "غائب" : "مشغول"
                        : member.status ?? "active"}
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

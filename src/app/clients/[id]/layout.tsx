"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  CalendarDays,
  CheckSquare,
  FileArchive,
  LayoutGrid,
  Sparkles,
  Users,
  Mail,
  Phone,
} from "lucide-react";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";

const TABS = [
  { id: "overview",   segment: "",          labelEn: "Overview",   labelAr: "نظرة عامة",   icon: LayoutGrid  },
  { id: "tasks",      segment: "tasks",     labelEn: "Tasks",      labelAr: "المهام",       icon: CheckSquare },
  { id: "content",    segment: "content",   labelEn: "Content",    labelAr: "المحتوى",      icon: CalendarDays},
  { id: "assets",     segment: "assets",    labelEn: "Assets",     labelAr: "الملفات",      icon: FileArchive },
  { id: "approvals",  segment: "approvals", labelEn: "Approvals",  labelAr: "الموافقات",    icon: Sparkles    },
  { id: "team",       segment: "team",      labelEn: "Team",       labelAr: "الفريق",       icon: Users       },
  { id: "activity",   segment: "activity",  labelEn: "Activity",   labelAr: "النشاط",       icon: Activity    },
];

export default function ClientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const params   = useParams();
  const pathname = usePathname();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const clientId = params.id as string;
  const client   = clients.find((c) => c.id === clientId);

  const getTabHref   = (seg: string) => seg === "" ? `/clients/${clientId}` : `/clients/${clientId}/${seg}`;
  const isTabActive  = (seg: string) => seg === "" ? pathname === `/clients/${clientId}` : pathname.startsWith(`/clients/${clientId}/${seg}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Back button */}
      <div>
        <Link
          href="/clients"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--panel)", padding: "8px 16px",
            fontSize: 13, fontWeight: 500, color: "var(--text)",
            textDecoration: "none", transition: "background 0.15s",
          }}
        >
          <ArrowLeft size={14} />
          {isArabic ? "العودة للعملاء" : "Back to Clients"}
        </Link>
      </div>

      {/* Client header */}
      {client && (
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "20px 24px",
          boxShadow: "var(--shadow)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}>
          {/* Avatar */}
          <div style={{
            width: 60, height: 60, borderRadius: 16, flexShrink: 0,
            background: client.color ?? "linear-gradient(135deg, var(--accent), var(--accent-2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, color: "white",
          }}>
            {client.initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
                {client.name}
              </h1>
              <span style={{
                fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 10px",
                background: client.status === "active"   ? "rgba(16,185,129,0.15)"
                           : client.status === "prospect" ? "rgba(245,158,11,0.15)"
                           : "rgba(100,116,139,0.15)",
                color: client.status === "active"   ? "#10b981"
                      : client.status === "prospect" ? "#f59e0b"
                      : "#64748b",
              }}>
                {isArabic
                  ? (client.status === "active" ? "نشط" : client.status === "prospect" ? "محتمل" : "غير نشط")
                  : client.status}
              </span>
            </div>
            {client.company && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
                {client.company}
              </p>
            )}
            {(client.email || client.phone) && (
              <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                {client.email && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
                    <Mail size={12} /> {client.email}
                  </span>
                )}
                {client.phone && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}>
                    <Phone size={12} /> {client.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div style={{
        display: "flex", gap: 4, overflowX: "auto",
        borderRadius: 18, border: "1px solid var(--border)",
        background: "var(--bg)", padding: 6,
        scrollbarWidth: "none",
      }}>
        {TABS.map((tab) => {
          const Icon   = tab.icon;
          const active = isTabActive(tab.segment);
          return (
            <Link
              key={tab.id}
              href={getTabHref(tab.segment)}
              style={{
                display: "inline-flex", flexShrink: 0, alignItems: "center", gap: 7,
                borderRadius: 12, padding: "9px 16px",
                fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? "var(--panel)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-muted)",
                boxShadow: active ? "var(--shadow-xs)" : "none",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
                textDecoration: "none",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={14} />
              {isArabic ? tab.labelAr : tab.labelEn}
            </Link>
          );
        })}
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  );
}

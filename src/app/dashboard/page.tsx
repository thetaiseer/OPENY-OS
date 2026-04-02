"use client";

import Link from "next/link";
import { Users2, CheckSquare, TrendingUp, Bell } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useNotifications } from "@/lib/NotificationContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  PageMotion,
  PageHeader,
  Panel,
  StatCard,
  EmptyPanel,
  pageText,
} from "@/components/redesign/ui";

export default function DashboardPage() {
  const { clients, totalClientCount } = useClients();
  const { tasks, openTaskCount } = useTasks();
  const { notifications, unreadCount } = useNotifications();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const activeClients = clients.filter((c) => c.status === "active").length;
  const recentClients = clients.slice(0, 5);
  const recentTasks = tasks.slice(0, 5);
  const recentNotifications = notifications.slice(0, 5);

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Overview", "نظرة عامة")}
        title={pageText("Dashboard", "لوحة التحكم")}
        description={pageText(
          "Welcome back. Here's what's happening in your workspace.",
          "مرحباً بعودتك. إليك ما يحدث في مساحة عملك."
        )}
        actions={
          <Link
            href="/clients"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Users2 size={15} />
            {isAr ? "عرض العملاء" : "View Clients"}
          </Link>
        }
      />

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          label={pageText("Total Clients", "إجمالي العملاء")}
          value={totalClientCount}
          icon={Users2}
          tone="blue"
          hint={pageText("All clients", "جميع العملاء")}
        />
        <StatCard
          label={pageText("Active Clients", "العملاء النشطون")}
          value={activeClients}
          icon={TrendingUp}
          tone="mint"
          hint={pageText("Currently active", "نشط حالياً")}
        />
        <StatCard
          label={pageText("Open Tasks", "المهام المفتوحة")}
          value={openTaskCount}
          icon={CheckSquare}
          tone="amber"
          hint={pageText("Needs attention", "يحتاج متابعة")}
        />
        <StatCard
          label={pageText("Unread Alerts", "تنبيهات غير مقروءة")}
          value={unreadCount}
          icon={Bell}
          tone="rose"
          hint={pageText("Notifications", "الإشعارات")}
          href="/notifications"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: 20,
        }}
      >
        {/* Recent clients */}
        <Panel
          title={pageText("Recent Clients", "أحدث العملاء")}
          action={
            <Link
              href="/clients"
              style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
            >
              {isAr ? "عرض الكل" : "View all"}
            </Link>
          }
        >
          {recentClients.length === 0 ? (
            <EmptyPanel
              icon={Users2}
              title={pageText("No clients yet", "لا يوجد عملاء بعد")}
              description={pageText("Add your first client to get started.", "أضف أول عميل للبدء.")}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {client.initials || client.name?.slice(0, 2).toUpperCase() || "??"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, margin: 0 }}>
                      {client.name}
                    </p>
                    {client.company && (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                        {client.company}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background:
                        client.status === "active"
                          ? "var(--success-soft)"
                          : client.status === "prospect"
                          ? "var(--warning-soft)"
                          : "var(--surface-2)",
                      color:
                        client.status === "active"
                          ? "var(--success)"
                          : client.status === "prospect"
                          ? "var(--warning)"
                          : "var(--text-muted)",
                    }}
                  >
                    {client.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent tasks + notifications */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel
            title={pageText("Open Tasks", "المهام المفتوحة")}
            action={
              <Link
                href="/tasks"
                style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
              >
                {isAr ? "عرض الكل" : "View all"}
              </Link>
            }
          >
            {recentTasks.length === 0 ? (
              <EmptyPanel
                icon={CheckSquare}
                title={pageText("No tasks", "لا توجد مهام")}
                description={pageText("All caught up!", "أنت محدّث تماماً!")}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <CheckSquare
                      size={14}
                      style={{
                        flexShrink: 0,
                        color: task.status === "done" ? "var(--success)" : "var(--text-muted)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: task.status === "done" ? "var(--text-muted)" : "var(--text)",
                        textDecoration: task.status === "done" ? "line-through" : "none",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={pageText("Notifications", "الإشعارات")}
            action={
              <Link
                href="/notifications"
                style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
              >
                {isAr ? "عرض الكل" : "View all"}
              </Link>
            }
          >
            {recentNotifications.length === 0 ? (
              <EmptyPanel
                icon={Bell}
                title={pageText("No notifications", "لا توجد إشعارات")}
                description={pageText("You're all caught up.", "لا جديد لديك.")}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentNotifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {!n.read && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          flexShrink: 0,
                          marginTop: 5,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: n.read ? 400 : 600,
                          color: "var(--text)",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {n.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageMotion>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Search, Sparkles, Target, Eye, Edit, Trash2 } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { AddClientModal } from "@/components/ui/AddClientModal";
import { EditClientModal } from "@/components/ui/EditClientModal";
import {
  BarListChart,
  EmptyPanel,
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #4F6EF7, #7C5CF6)",
  "linear-gradient(135deg, #10B981, #059669)",
  "linear-gradient(135deg, #F59E0B, #EF4444)",
  "linear-gradient(135deg, #8B5CF6, #EC4899)",
  "linear-gradient(135deg, #06B6D4, #3B82F6)",
  "linear-gradient(135deg, #F97316, #FB923C)",
];

function getAvatarGradient(name: string): string {
  if (!name) return AVATAR_GRADIENTS[0];
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

interface ClientEntry {
  id: string;
  name: string;
  company?: string;
  email?: string;
  status: string;
  initials?: string;
  [key: string]: unknown;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        borderRadius: 8,
        textAlign: "center",
        padding: "10px 8px",
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{value}</div>
    </div>
  );
}

export default function ClientsPage() {
  const { clients, deleteClient } = useClients();
  const { tasks } = useTasks();
  const { contentItems } = useContentItems();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();

  const [showAddClient, setShowAddClient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editClient, setEditClient] = useState<ClientEntry | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteClient(id);
      showToast(isArabic ? "تم حذف العميل بنجاح" : "Client deleted successfully", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        isArabic ? `فشل حذف العميل: ${msg}` : `Failed to delete client: ${msg}`,
        "error"
      );
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const activeClients = clients.filter((c) => c.status === "active").length;
  const prospects = clients.filter((c) => c.status === "prospect").length;

  const clientLoad = clients.map((client) => {
    const contentCount = contentItems.filter((item) => item.clientId === client.id).length;
    const openTasks = tasks.filter((t) => t.clientId === client.id && t.status !== "done").length;
    return { client, contentCount, openTasks, score: contentCount * 3 + openTasks * 2 };
  });

  const filteredLoad = clientLoad.filter(({ client }) => {
    const matchSearch =
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      (client.company ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || client.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const healthiest = [...clientLoad]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ client, contentCount, openTasks, score }) => ({
      label: client.name,
      value: score,
      meta: isArabic
        ? `${contentCount} محتوى · ${openTasks} مهام`
        : `${contentCount} content · ${openTasks} tasks`,
    }));

  const STATUS_PILLS = [
    { value: "all",      label: isArabic ? "الكل"        : "All"      },
    { value: "active",   label: isArabic ? "نشط"         : "Active"   },
    { value: "prospect", label: isArabic ? "محتمل"       : "Prospect" },
    { value: "inactive", label: isArabic ? "غير نشط"     : "Inactive" },
  ];

  return (
    <PageMotion>
      <AddClientModal open={showAddClient} onClose={() => setShowAddClient(false)} />
      <EditClientModal client={editClient} onClose={() => setEditClient(null)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف العميل" : "Delete client"}
        message={
          isArabic
            ? "هل أنت متأكد من حذف هذا العميل؟ سيتم إزالة جميع البيانات المرتبطة به."
            : "Are you sure you want to delete this client? All associated data will be unlinked."
        }
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <PageHeader
        eyebrow={pageText("Client management", "إدارة العملاء")}
        title={pageText("Clients", "العملاء")}
        description={pageText(
          "Manage client accounts, track delivery health and open tasks.",
          "إدارة حسابات العملاء ومتابعة صحة التسليم والمهام المفتوحة."
        )}
        actions={
          <button
            type="button"
            onClick={() => setShowAddClient(true)}
            className="btn btn-primary"
          >
            + {isArabic ? "إضافة عميل" : "Add Client"}
          </button>
        }
      />

      <section className="stat-grid" style={{ marginBottom: 32 }}>
        <StatCard
          label={pageText("Total clients", "إجمالي العملاء")}
          value={clients.length}
          hint={pageText("All records in your workspace", "كل السجلات في مساحة العمل")}
          icon={BriefcaseBusiness}
          tone="blue"
        />
        <StatCard
          label={pageText("Active", "النشطون")}
          value={activeClients}
          hint={pageText("Accounts in live service", "حسابات في خدمة مباشرة")}
          icon={CheckCircle2}
          tone="mint"
        />
        <StatCard
          label={pageText("Prospects", "العملاء المحتملون")}
          value={prospects}
          hint={pageText("Pipeline opportunities", "فرص في خط المبيعات")}
          icon={Target}
          tone="amber"
        />
        <StatCard
          label={pageText("Content volume", "حجم المحتوى")}
          value={contentItems.length}
          hint={pageText("Content tied to clients", "المحتوى المرتبط بالعملاء")}
          icon={Sparkles}
          tone="blue"
        />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 20 }}>
        <Panel
          title={pageText("Client portfolio", "محفظة العملاء")}
          description={pageText(
            "All client accounts with health indicators.",
            "جميع حسابات العملاء مع مؤشرات الصحة."
          )}
          action={
            <InfoBadge
              label={isArabic ? `${filteredLoad.length} سجل` : `${filteredLoad.length} records`}
              tone="blue"
            />
          }
        >
          {/* Search + filter toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <div style={{ position: "relative", flex: "1 1 180px", maxWidth: 280 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isArabic ? "بحث عن عميل..." : "Search clients..."}
                className="input"
                style={{ paddingLeft: 32 }}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUS_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  style={{
                    borderRadius: 999,
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: statusFilter === pill.value ? "var(--accent)" : "var(--surface-2)",
                    color: statusFilter === pill.value ? "#fff" : "var(--text-muted)",
                    border: `1px solid ${statusFilter === pill.value ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {filteredLoad.length === 0 ? (
            <EmptyPanel
              title={pageText("No clients found", "لم يتم العثور على عملاء")}
              description={pageText(
                "Try adjusting your search or filter.",
                "جرب تعديل البحث أو الفلتر."
              )}
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {filteredLoad.map(({ client, contentCount, openTasks }) => (
                <div
                  key={client.id}
                  className="card"
                  style={{ padding: 16, transition: "box-shadow 0.15s, transform 0.15s" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
                    (e.currentTarget as HTMLElement).style.transform = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <Link
                      href={`/clients/${client.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textDecoration: "none" }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: 16,
                          flexShrink: 0,
                          background: getAvatarGradient(client.name),
                        }}
                      >
                        {(client.name?.length > 0 ? client.name[0] : "?").toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            margin: 0,
                          }}
                        >
                          {client.name}
                        </h3>
                        <InfoBadge
                          label={client.status}
                          tone={
                            client.status === "active"
                              ? "mint"
                              : client.status === "prospect"
                              ? "amber"
                              : "muted"
                          }
                        />
                      </div>
                    </Link>
                    <ActionMenu
                      items={[
                        {
                          label: isArabic ? "عرض التفاصيل" : "View details",
                          icon: Eye,
                          onClick: () => {},
                        },
                        {
                          label: isArabic ? "تعديل" : "Edit",
                          icon: Edit,
                          onClick: () => setEditClient(client as ClientEntry),
                        },
                        {
                          label: isArabic ? "حذف" : "Delete",
                          icon: Trash2,
                          tone: "danger",
                          onClick: () => setConfirmDelete(client.id),
                        },
                      ]}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <MiniStat label={isArabic ? "المحتوى" : "Content"} value={contentCount} />
                    <MiniStat label={isArabic ? "المهام" : "Tasks"} value={openTasks} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={pageText("Health leaderboard", "لوحة صحة الحسابات")}
          description={pageText(
            "A simple ranking based on content volume and open tasks.",
            "ترتيب مبسط يعتمد على حجم المحتوى والمهام المفتوحة."
          )}
          action={
            <InfoBadge label={isArabic ? "تحليلات مباشرة" : "Live analytics"} tone="blue" />
          }
        >
          {healthiest.length === 0 ? (
            <EmptyPanel
              title={pageText("No ranking yet", "لا يوجد ترتيب بعد")}
              description={pageText(
                "Client ranking will appear once accounts have content and tasks.",
                "سيظهر ترتيب العملاء بمجرد إضافة محتوى ومهام."
              )}
            />
          ) : (
            <BarListChart items={healthiest} tone="blue" />
          )}
        </Panel>
      </div>
    </PageMotion>
  );
}

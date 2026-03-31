"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { BriefcaseBusiness, CheckCircle2, Search, Sparkles, Target, Eye, Edit, Archive, Trash2 } from "lucide-react";
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
  pageText } from
"@/components/redesign/ui";



const AVATAR_GRADIENTS = [
"linear-gradient(135deg, #4F6EF7, #7C5CF6)",
"linear-gradient(135deg, #10B981, #059669)",
"linear-gradient(135deg, #F59E0B, #EF4444)",
"linear-gradient(135deg, #8B5CF6, #EC4899)",
"linear-gradient(135deg, #06B6D4, #3B82F6)",
"linear-gradient(135deg, #F97316, #FB923C)"];


function getAvatarGradient(name) {
  if (!name) return AVATAR_GRADIENTS[0];
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];
}

export default function ClientsPage() {
  const { clients, deleteClient } = useClients();
  const { tasks } = useTasks();
  const { contentItems } = useContentItems();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [showAddClient, setShowAddClient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteClient(id);
      showToast(isArabic ? "تم حذف العميل بنجاح" : "Client deleted successfully", "success");
    } catch (err) {
      // Failure path: show toast so the user knows what went wrong
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        isArabic ?
        `فشل حذف العميل: ${msg}` :
        `Failed to delete client: ${msg}`,
        "error"
      );
    } finally {
      // Always close the modal and reset loading so the UI is never stuck
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const activeClients = clients.filter((client) => client.status === "active").length;
  const prospects = clients.filter((client) => client.status === "prospect").length;
  const clientLoad = clients.map((client) => {
    const contentCount = contentItems.filter((item) => item.clientId === client.id).length;
    const openTasks = tasks.filter((task) => task.clientId === client.id && task.status !== "done").length;
    return {
      client,
      contentCount,
      openTasks,
      score: contentCount * 3 + openTasks * 2
    };
  });

  const filteredLoad = clientLoad.filter((entry) => {
    const matchSearch =
    entry.client.name.toLowerCase().includes(search.toLowerCase()) ||
    (entry.client.company ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || entry.client.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const healthiest = [...clientLoad].
  sort((a, b) => b.score - a.score).
  slice(0, 6).
  map((entry) => ({
    label: entry.client.name,
    value: entry.score,
    meta: isArabic ? `${entry.contentCount} محتوى · ${entry.openTasks} مهام` : `${entry.contentCount} content · ${entry.openTasks} tasks`
  }));

  const STATUS_PILLS = [
  { value: "all", label: isArabic ? "الكل" : "All" },
  { value: "active", label: isArabic ? "نشط" : "Active" },
  { value: "prospect", label: isArabic ? "محتمل" : "Prospect" },
  { value: "inactive", label: isArabic ? "غير نشط" : "Inactive" }];


  return (
    <PageMotion>
      <AddClientModal open={showAddClient} onClose={() => setShowAddClient(false)} />
      <EditClientModal client={editClient} onClose={() => setEditClient(null)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف العميل" : "Delete client"}
        message={isArabic ? "هل أنت متأكد من حذف هذا العميل؟ سيتم إزالة جميع البيانات المرتبطة به." : "Are you sure you want to delete this client? All associated data will be unlinked."}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)} />
      
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
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "white", borderRadius: 12, padding: "10px 20px", fontSize: 14, fontWeight: 600 }}>
          
            + {isArabic ? "إضافة عميل" : "Add Client"}
          </button>
        } />
      

      <section className="stat-grid">
        <StatCard label={pageText("Total clients", "إجمالي العملاء")} value={clients.length} hint={pageText("All records in your workspace", "كل السجلات في مساحة العمل")} icon={BriefcaseBusiness} tone="blue" />
        <StatCard label={pageText("Active", "النشطون")} value={activeClients} hint={pageText("Accounts in live service", "حسابات في خدمة مباشرة")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Prospects", "العملاء المحتملون")} value={prospects} hint={pageText("Pipeline opportunities", "فرص في خط المبيعات")} icon={Target} tone="amber" />
        <StatCard label={pageText("Content volume", "حجم المحتوى")} value={contentItems.length} hint={pageText("Content tied to clients", "المحتوى المرتبط بالعملاء")} icon={Sparkles} tone="violet" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title={pageText("Client portfolio", "محفظة العملاء")}
          description={pageText("All client accounts with health indicators.", "جميع حسابات العملاء مع مؤشرات الصحة.")}
          action={<InfoBadge label={isArabic ? `${filteredLoad.length} سجل` : `${filteredLoad.length} records`} tone="blue" />}>
          
          {/* Search + Filter Toolbar */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-xs">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isArabic ? "بحث عن عميل..." : "Search clients..."}
                className="glass-input w-full ps-9 py-2 text-sm" />
              
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_PILLS.map((pill) =>
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150"
                style={{
                  background: statusFilter === pill.value ? "var(--accent)" : "var(--glass-overlay)",
                  color: statusFilter === pill.value ? "white" : "var(--muted)",
                  border: `1px solid ${statusFilter === pill.value ? "var(--accent)" : "var(--border)"}`
                }}>
                
                  {pill.label}
                </button>
              )}
            </div>
          </div>

          {filteredLoad.length === 0 ?
          <EmptyPanel
            title={pageText("No clients found", "لم يتم العثور على عملاء")}
            description={pageText("Try adjusting your search or filter.", "جرب تعديل البحث أو الفلتر.")} /> :


          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredLoad.map((entry) =>
            <motion.div
              key={entry.client.id}
              whileHover={{ y: -2 }}
              className="card card-hover p-5 cursor-pointer">
              
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/clients/${entry.client.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                    style={{ background: getAvatarGradient(entry.client.name) }}>
                    
                        {(entry.client.name?.length > 0 ? entry.client.name[0] : "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate text-sm" style={{ color: "var(--text)" }}>{entry.client.name}</h3>
                        <InfoBadge
                      label={entry.client.status}
                      tone={entry.client.status === "active" ? "mint" : entry.client.status === "prospect" ? "amber" : "slate"} />
                    
                      </div>
                    </Link>
                    <ActionMenu
                  items={[
                  { label: isArabic ? "عرض التفاصيل" : "View details", icon: Eye, onClick: () => {} },
                  { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: () => setEditClient(entry.client) },
                  { label: isArabic ? "أرشفة" : "Archive", icon: Archive, onClick: () => {} },
                  { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(entry.client.id) }]
                  } />
                
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <MiniStat label={isArabic ? "المحتوى" : "Content"} value={entry.contentCount} />
                    <MiniStat label={isArabic ? "المهام" : "Tasks"} value={entry.openTasks} />
                  </div>
                </motion.div>
            )}
            </div>
          }
        </Panel>

        <Panel
          title={pageText("Health leaderboard", "لوحة صحة الحسابات")}
          description={pageText("A simple ranking based on content volume and open tasks.", "ترتيب مبسط يعتمد على حجم المحتوى والمهام المفتوحة.")}
          action={<InfoBadge label={isArabic ? "تحليلات مباشرة" : "Live analytics"} tone="violet" />}>
          
          {healthiest.length === 0 ?
          <EmptyPanel
            title={pageText("No ranking yet", "لا يوجد ترتيب بعد")}
            description={pageText("Client ranking will appear once accounts have content and tasks.", "سيظهر ترتيب العملاء بمجرد إضافة محتوى ومهام.")} /> :


          <BarListChart items={healthiest} tone="violet" />
          }
        </Panel>
      </section>
    </PageMotion>);

}

function MiniStat({ label, value }) {
  return (
    <div
      className="rounded-2xl text-center px-2 py-3"
      style={{ border: "1px solid var(--border)", background: "var(--glass-overlay)" }}>
      
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1.5 text-lg font-semibold" style={{ color: "var(--text)" }}>{value}</div>
    </div>);

}
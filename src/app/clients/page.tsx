"use client";
import { useState, useMemo, useCallback } from "react";
import {
  Users2, Plus, Search, Globe, Mail, Phone, Trash2, Pencil,
  Eye, LayoutGrid, List, ChevronUp, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Client } from "@/lib/types";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────
type View = "cards" | "table";
type StatusFilter = "all" | "active" | "prospect" | "inactive";
type SortField = "name" | "company" | "email" | "status" | "createdAt";
type SortDir = "asc" | "desc";

type FormData = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  status: Client["status"];
};

const defaultForm: FormData = {
  name: "", company: "", email: "", phone: "", website: "", status: "prospect",
};

// ── Config ────────────────────────────────────────────────────
const STATUS_BADGE_COLOR: Record<string, "green" | "yellow" | "gray"> = {
  active: "green",
  prospect: "yellow",
  inactive: "gray",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  prospect: "Prospect",
  inactive: "Inactive",
};

// ── SortIcon ──────────────────────────────────────────────────
function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field)
    return <span style={{ color: "var(--text-muted)", fontSize: 10, opacity: 0.5 }}>↕</span>;
  return sortDir === "asc"
    ? <ChevronUp size={11} style={{ color: "var(--accent)" }} />
    : <ChevronDown size={11} style={{ color: "var(--accent)" }} />;
}

// ── Main Page ─────────────────────────────────────────────────
export default function ClientsPage() {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { t } = useLanguage();

  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Stats
  const activeCount = useMemo(() => clients.filter(c => c.status === "active").length, [clients]);
  const prospectCount = useMemo(() => clients.filter(c => c.status === "prospect").length, [clients]);
  const inactiveCount = useMemo(() => clients.filter(c => c.status === "inactive").length, [clients]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q),
    );
    if (statusFilter !== "all") list = list.filter(c => c.status === statusFilter);
    return [...list].sort((a, b) => {
      const av = String(a[sortField] ?? "");
      const bv = String(b[sortField] ?? "");
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [clients, search, statusFilter, sortField, sortDir]);

  const handleSort = useCallback((f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  }, [sortField]);

  const openAdd = useCallback(() => {
    setEditClient(null);
    setForm(defaultForm);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((client: Client) => {
    setEditClient(client);
    setForm({
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone ?? "",
      website: client.website ?? "",
      status: client.status,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditClient(null);
    setForm(defaultForm);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name || !form.email) return;
    if (editClient) {
      await updateClient(editClient.id, {
        name: form.name,
        company: form.company || form.name,
        email: form.email,
        phone: form.phone || undefined,
        website: form.website || undefined,
        status: form.status,
        initials: form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      });
    } else {
      await addClient({
        name: form.name,
        email: form.email,
        website: form.website || undefined,
        phone: form.phone || undefined,
      });
    }
    closeModal();
  }, [form, editClient, updateClient, addClient, closeModal]);

  const TABLE_COLS: { field: SortField; label: string }[] = [
    { field: "name", label: "Name" },
    { field: "company", label: "Company" },
    { field: "email", label: "Email" },
    { field: "status", label: "Status" },
    { field: "createdAt", label: "Created" },
  ];

  return (
    <div>
      <SectionHeader
        title={t("clients.title")}
        subtitle="Manage your client relationships"
        icon={Users2}
        action={<Button icon={Plus} onClick={openAdd}>{t("clients.addClient")}</Button>}
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Active", count: activeCount, color: "var(--success)", bg: "rgba(52,211,153,0.09)" },
          { label: "Prospect", count: prospectCount, color: "var(--warning)", bg: "rgba(251,191,36,0.09)" },
          { label: "Inactive", count: inactiveCount, color: "var(--text-muted)", bg: "var(--surface-2)" },
        ].map(({ label, count, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: bg, border: "1px solid var(--border)" }}
          >
            <div className="text-2xl font-bold" style={{ color }}>{count}</div>
            <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <Input
            placeholder={t("clients.searchPlaceholder")}
            value={search}
            onChange={setSearch}
            icon={Search}
          />
        </div>

        {/* Status filter pills */}
        <div
          className="flex gap-1 rounded-xl p-1 flex-wrap sm:flex-nowrap"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {(["all", "active", "prospect", "inactive"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={{
                background: statusFilter === s ? "var(--accent)" : "transparent",
                color: statusFilter === s ? "white" : "var(--text-secondary)",
              }}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setView("cards")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
            style={{
              background: view === "cards" ? "var(--accent)" : "transparent",
              color: view === "cards" ? "white" : "var(--text-secondary)",
            }}
          >
            <LayoutGrid size={13} /> Cards
          </button>
          <button
            onClick={() => setView("table")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
            style={{
              background: view === "table" ? "var(--accent)" : "transparent",
              color: view === "table" ? "white" : "var(--text-secondary)",
            }}
          >
            <List size={13} /> Table
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t("clients.noClientsTitle")}
          description={t("clients.noClientsDesc")}
          action={<Button icon={Plus} onClick={openAdd}>{t("clients.addClient")}</Button>}
        />
      ) : view === "cards" ? (
        /* ── Card View ─────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((client, i) => (
              <motion.div
                key={client.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.04, 0.3) }}
                whileHover={{ y: -3 }}
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{
                  background: "var(--glass-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: client.color }}
                  >
                    {client.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
                      {client.name}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                      {client.company}
                    </p>
                  </div>
                  <Badge label={STATUS_LABEL[client.status]} color={STATUS_BADGE_COLOR[client.status]} />
                </div>

                {/* Contact info */}
                <div className="space-y-1.5">
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-2 text-xs truncate hover:opacity-70 transition-opacity"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Mail size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    {client.email}
                  </a>
                  {client.phone && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <Phone size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      {client.phone}
                    </div>
                  )}
                  {client.website && (
                    <a
                      href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs truncate hover:opacity-70 transition-opacity"
                      style={{ color: "var(--accent)" }}
                    >
                      <Globe size={12} style={{ flexShrink: 0 }} />
                      {client.website}
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-2 pt-1"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <Link href={`/clients/${client.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" icon={Eye} fullWidth>
                      View Profile
                    </Button>
                  </Link>
                  <button
                    onClick={() => openEdit(client)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                    style={{ color: "var(--text-secondary)", background: "var(--surface-3)" }}
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteClient(client.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
                    style={{ color: "var(--error)", background: "rgba(248,113,113,0.10)" }}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* ── Table View ────────────────────────────────── */
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--glass-card)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  {TABLE_COLS.map(col => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <span className="flex items-center gap-1.5">
                        {col.label}
                        <SortIcon field={col.field} sortField={sortField} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                  <th
                    className="text-right px-5 py-3 text-xs font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    className="transition-colors"
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                          style={{ background: client.color }}
                        >
                          {client.initials}
                        </div>
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {client.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {client.company}
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {client.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge label={STATUS_LABEL[client.status]} color={STATUS_BADGE_COLOR[client.status]} />
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/clients/${client.id}`}>
                          <button
                            className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80"
                            style={{ color: "var(--accent)", background: "var(--accent-dim)" }}
                          >
                            <Eye size={11} /> View
                          </button>
                        </Link>
                        <button
                          onClick={() => openEdit(client)}
                          className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80"
                          style={{ color: "var(--text-secondary)", background: "var(--surface-3)" }}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          onClick={() => deleteClient(client.id)}
                          className="text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-opacity hover:opacity-80"
                          style={{ color: "var(--error)", background: "rgba(248,113,113,0.10)" }}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editClient ? t("clients.editTitle") : t("clients.modalTitle")}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("clients.nameLabel")}
              placeholder={t("clients.namePlaceholder")}
              value={form.name}
              onChange={v => setForm(p => ({ ...p, name: v }))}
              required
            />
            <Input
              label="Company"
              placeholder="Company name"
              value={form.company}
              onChange={v => setForm(p => ({ ...p, company: v }))}
            />
          </div>
          <Input
            label={t("clients.emailLabel")}
            placeholder={t("clients.emailPlaceholder")}
            value={form.email}
            onChange={v => setForm(p => ({ ...p, email: v }))}
            type="email"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              placeholder="+1 234 567 8900"
              value={form.phone}
              onChange={v => setForm(p => ({ ...p, phone: v }))}
            />
            <Input
              label={t("clients.websiteLabel")}
              placeholder={t("clients.websitePlaceholder")}
              value={form.website}
              onChange={v => setForm(p => ({ ...p, website: v }))}
              icon={Globe}
            />
          </div>

          {/* Status selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Status</label>
            <div className="flex gap-2">
              {(["active", "prospect", "inactive"] as Client["status"][]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, status: s }))}
                  className="flex-1 py-2 text-xs font-medium rounded-xl transition-all capitalize"
                  style={{
                    background: form.status === s
                      ? s === "active" ? "rgba(52,211,153,0.18)" : s === "prospect" ? "rgba(251,191,36,0.18)" : "var(--surface-3)"
                      : "var(--surface-2)",
                    color: form.status === s
                      ? s === "active" ? "var(--success)" : s === "prospect" ? "var(--warning)" : "var(--text-secondary)"
                      : "var(--text-muted)",
                    border: `1px solid ${form.status === s
                      ? s === "active" ? "rgba(52,211,153,0.35)" : s === "prospect" ? "rgba(251,191,36,0.35)" : "var(--border)"
                      : "var(--border)"}`,
                  }}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <Button variant="ghost" onClick={closeModal}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!form.name || !form.email}>
              {editClient ? t("common.save") : t("clients.addClient")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

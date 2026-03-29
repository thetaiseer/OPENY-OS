"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Users2, Plus, Search, Globe, Mail, Phone,
  Trash2, Pencil, Eye, LayoutGrid, List,
  ChevronUp, ChevronDown, Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
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
  status: "active" | "inactive" | "prospect";
};

const defaultForm: FormData = {
  name: "", company: "", email: "", phone: "", website: "", status: "prospect",
};

// ── Config ────────────────────────────────────────────────────

const STATUS_BADGE_COLOR: Record<Client["status"], "green" | "yellow" | "gray"> = {
  active: "green",
  prospect: "yellow",
  inactive: "gray",
};

const STATUS_LABEL: Record<Client["status"], string> = {
  active: "Active",
  prospect: "Prospect",
  inactive: "Inactive",
};

const SORT_LABELS: Record<SortField, string> = {
  name: "Name",
  company: "Company",
  email: "Email",
  status: "Status",
  createdAt: "Date Added",
};

// ── Helpers ───────────────────────────────────────────────────

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field)
    return <span style={{ color: "var(--text-muted)", fontSize: 10, opacity: 0.5 }}>↕</span>;
  return sortDir === "asc"
    ? <ChevronUp size={11} style={{ color: "var(--accent)" }} />
    : <ChevronDown size={11} style={{ color: "var(--accent)" }} />;
}

function Avatar({ initials, color, size = 40 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.04, type: "spring", stiffness: 360, damping: 28 },
  }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// ── Main Page ─────────────────────────────────────────────────

export default function ClientsPage() {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { isRTL } = useLanguage();

  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Stats
  const activeCount = useMemo(() => clients.filter(c => c.status === "active").length, [clients]);
  const prospectCount = useMemo(() => clients.filter(c => c.status === "prospect").length, [clients]);
  const inactiveCount = useMemo(() => clients.filter(c => c.status === "inactive").length, [clients]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...clients]
      .filter(c => {
        const matchSearch = !q ||
          c.name.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || c.status === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        let av = (a[sortField] ?? "").toLowerCase();
        let bv = (b[sortField] ?? "").toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [clients, search, statusFilter, sortField, sortDir]);

  // Modal helpers
  const openAdd = useCallback(() => {
    setEditClient(null);
    setForm(defaultForm);
    setErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((c: Client) => {
    setEditClient(c);
    setForm({ name: c.name, company: c.company ?? "", email: c.email, phone: c.phone ?? "", website: c.website ?? "", status: c.status });
    setErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditClient(null);
    setErrors({});
  }, []);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editClient) {
        await updateClient(editClient.id, {
          name: form.name.trim(),
          company: form.company.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          website: form.website.trim() || undefined,
          status: form.status,
        });
      } else {
        await addClient({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          website: form.website.trim() || undefined,
        });
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteClient(id);
    setDeleteConfirm(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const setF = (key: keyof FormData, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  // Loading guard
  if (clients === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 24px 48px", direction: isRTL ? "rtl" : "ltr" }}>

      {/* A. Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "var(--radius-md)", background: "rgba(79,142,247,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users2 size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Clients</h1>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "var(--accent)",
                  background: "rgba(79,142,247,0.12)", padding: "2px 8px", borderRadius: 100,
                }}>{clients.length}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>Manage your client relationships</p>
            </div>
          </div>
          <Button icon={Plus} onClick={openAdd} size="md">Add Client</Button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="client-stat-grid">
          {[
            { label: "Total", value: clients.length, color: "#4f8ef7", bg: "rgba(79,142,247,0.1)" },
            { label: "Active", value: activeCount, color: "#34d399", bg: "rgba(52,211,153,0.1)" },
            { label: "Prospects", value: prospectCount, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
            { label: "Inactive", value: inactiveCount, color: "#8888a0", bg: "rgba(136,136,160,0.1)" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="stat-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 0", fontWeight: 500 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* B. Search + Filter Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            style={{
              width: "100%", paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              borderRadius: "var(--radius-md)", background: "var(--glass-input)",
              border: "1px solid var(--border)", color: "var(--text-primary)",
              fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Status filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "active", "prospect", "inactive"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: statusFilter === s ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: statusFilter === s ? "rgba(79,142,247,0.12)" : "var(--glass-overlay)",
                color: statusFilter === s ? "var(--accent)" : "var(--text-secondary)",
                transition: "all 0.15s",
              }}
            >
              {s === "all" ? "All" : STATUS_LABEL[s as Client["status"]]}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <select
          value={`${sortField}:${sortDir}`}
          onChange={e => {
            const [f, d] = e.target.value.split(":") as [SortField, SortDir];
            setSortField(f);
            setSortDir(d);
          }}
          style={{
            padding: "7px 10px", borderRadius: "var(--radius-md)", fontSize: 12, cursor: "pointer",
            border: "1px solid var(--border)", background: "var(--glass-overlay)",
            color: "var(--text-secondary)", outline: "none",
          }}
        >
          {(Object.entries(SORT_LABELS) as [SortField, string][]).flatMap(([f, l]) => [
            <option key={`${f}:asc`} value={`${f}:asc`}>{l} ↑</option>,
            <option key={`${f}:desc`} value={`${f}:desc`}>{l} ↓</option>,
          ])}
        </select>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", borderRadius: "var(--radius-md)", padding: 3, border: "1px solid var(--border)" }}>
          {([["cards", LayoutGrid], ["table", List]] as [View, typeof LayoutGrid][]).map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "5px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                background: view === v ? "var(--accent)" : "transparent",
                color: view === v ? "#fff" : "var(--text-muted)",
                transition: "all 0.15s", display: "flex", alignItems: "center",
              }}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </motion.div>

      {/* Empty states */}
      {clients.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-state"
          style={{ padding: "60px 24px" }}
        >
          <Users2 size={48} style={{ color: "var(--text-muted)", marginBottom: 16, opacity: 0.5 }} />
          <p style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No clients yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Add your first client to get started</p>
          <Button icon={Plus} onClick={openAdd}>Add Client</Button>
        </motion.div>
      )}

      {clients.length > 0 && filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state" style={{ padding: "48px 24px" }}>
          <Search size={36} style={{ color: "var(--text-muted)", marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>No results found</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Try adjusting your search or filters</p>
        </motion.div>
      )}

      {/* C. Grid View */}
      {view === "cards" && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}
          className="clients-grid"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((client, i) => (
              <motion.div
                key={client.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                layout
                className="premium-card"
                style={{ padding: "20px", position: "relative", overflow: "visible" }}
              >
                {/* Avatar + name */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  <Avatar initials={client.initials} color={client.color} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {client.name}
                    </p>
                    {client.company && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "2px 0 0",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                        <Building2 size={11} style={{ flexShrink: 0 }} /> {client.company}
                      </p>
                    )}
                  </div>
                  <Badge label={STATUS_LABEL[client.status]} color={STATUS_BADGE_COLOR[client.status]} />
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Mail size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--text-secondary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {client.email}
                    </span>
                  </div>
                  {client.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Phone size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{client.phone}</span>
                    </div>
                  )}
                  {client.website && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Globe size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <a
                        href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
                        onClick={e => e.stopPropagation()}
                      >
                        {client.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {deleteConfirm === client.id ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: "10px 12px", borderRadius: "var(--radius-sm)",
                      background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)",
                    }}
                  >
                    <p style={{ fontSize: 12, color: "var(--error)", marginBottom: 8 }}>Delete this client?</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(client.id)}>Delete</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    </div>
                  </motion.div>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(client)}>Edit</Button>
                    <Button size="sm" variant="destructive" icon={Trash2} onClick={() => setDeleteConfirm(client.id)} />
                    <Link href={`/clients/${client.id}`} style={{ marginLeft: "auto", textDecoration: "none" }}>
                      <Button size="sm" variant="secondary" icon={Eye} iconPosition="right">View</Button>
                    </Link>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* D. Table View */}
      {view === "table" && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="premium-card"
          style={{ overflowX: "auto", padding: 0 }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {(["name", "company", "email", "status"] as SortField[]).map(field => (
                  <th key={field}
                    onClick={() => toggleSort(field)}
                    style={{
                      padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
                      color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6,
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {SORT_LABELS[field]}
                      <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                    </span>
                  </th>
                ))}
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 700,
                  color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    style={{ borderBottom: "1px solid var(--border)", transition: "background 0.12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar initials={client.initials} color={client.color} size={34} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{client.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{client.company || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{client.email}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <Badge label={STATUS_LABEL[client.status]} color={STATUS_BADGE_COLOR[client.status]} />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {deleteConfirm === client.id ? (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--error)" }}>Delete?</span>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(client.id)}>Yes</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>No</Button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => openEdit(client)} title="Edit"
                            style={{ padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--glass-overlay)", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteConfirm(client.id)} title="Delete"
                            style={{ padding: 6, borderRadius: 8, border: "1px solid rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.06)", cursor: "pointer", color: "var(--error)", display: "flex" }}>
                            <Trash2 size={13} />
                          </button>
                          <Link href={`/clients/${client.id}`}>
                            <button title="View"
                              style={{ padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--glass-overlay)", cursor: "pointer", color: "var(--accent)", display: "flex" }}>
                              <Eye size={13} />
                            </button>
                          </Link>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </motion.div>
      )}

      {/* E. Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editClient ? "Edit Client" : "Add Client"}
        maxWidth="min(92vw, 520px)"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Name <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <Input
              value={form.name}
              onChange={v => setF("name", v)}
              placeholder="Client name"
            />
            {errors.name && <p style={{ fontSize: 11, color: "var(--error)", marginTop: 4 }}>{errors.name}</p>}
          </div>

          {/* Company (edit only for create — shown in both but only saved on edit) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Company {!editClient && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>(can be updated after saving)</span>}
            </label>
            <Input
              value={form.company}
              onChange={v => setF("company", v)}
              placeholder="Company name"
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Email <span style={{ color: "var(--error)" }}>*</span>
            </label>
            <Input
              value={form.email}
              onChange={v => setF("email", v)}
              placeholder="email@example.com"
              type="email"
            />
            {errors.email && <p style={{ fontSize: 11, color: "var(--error)", marginTop: 4 }}>{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Phone</label>
            <Input
              value={form.phone}
              onChange={v => setF("phone", v)}
              placeholder="+1 (555) 000-0000"
              type="tel"
            />
          </div>

          {/* Website */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Website</label>
            <Input
              value={form.website}
              onChange={v => setF("website", v)}
              placeholder="https://example.com"
              type="url"
            />
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Status</label>
            <select
              value={form.status}
              onChange={e => setF("status", e.target.value)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: "var(--radius-md)",
                background: "var(--glass-input)", border: "1px solid var(--border)",
                color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <Button variant="primary" onClick={handleSave} disabled={saving} fullWidth>
              {saving ? "Saving…" : editClient ? "Save Changes" : "Add Client"}
            </Button>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .clients-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .client-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .clients-grid { grid-template-columns: 1fr !important; }
          .client-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

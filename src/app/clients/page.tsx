"use client";
import { useState } from "react";
import { Users2, Plus, Search, Building2, Globe, Mail, Trash2, Pencil } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Client } from "@/lib/types";

const statusColors: Record<string, "green" | "blue" | "gray"> = {
  active: "green",
  prospect: "blue",
  inactive: "gray",
};

export default function ClientsPage() {
  const { clients, addClient, updateClient, deleteClient } = useClients();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", email: "", website: "" });

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    addClient({ name: form.name, email: form.email, website: form.website });
    setForm({ name: "", email: "", website: "" });
    setModalOpen(false);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setForm({ name: client.name, email: client.email, website: client.website ?? "" });
  };

  const handleEdit = () => {
    if (!editClient || !form.name || !form.email) return;
    updateClient(editClient.id, {
      name: form.name,
      company: form.name,
      email: form.email,
      website: form.website || undefined,
      initials: form.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    });
    setEditClient(null);
    setForm({ name: "", email: "", website: "" });
  };

  const handleDelete = (id: string) => {
    deleteClient(id);
  };

  const subtitle = `${clients.length} ${clients.length === 1 ? t("clients.totalClient") : t("clients.totalClients")}`;

  return (
    <div>
      <SectionHeader
        title={t("clients.title")}
        subtitle={subtitle}
        icon={Users2}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("clients.addClient")}</Button>}
      />

      <div className="mb-5">
        <Input placeholder={t("clients.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={t("clients.noClientsTitle")}
          description={t("clients.noClientsDesc")}
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("clients.addClient")}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Card key={client.id}>
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: client.color }}
                >
                  {client.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{client.name}</p>
                    <Badge label={t(`status.${client.status}`) || client.status} color={statusColors[client.status]} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2">
                  <Mail size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{client.email}</span>
                </div>
                {client.website && (
                  <div className="flex items-center gap-2">
                    <Globe size={12} style={{ color: "var(--text-muted)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{client.website}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Building2 size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{client.projects} {t("clients.activeProjects")}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth icon={Pencil} onClick={() => openEdit(client)}>{t("common.edit")}</Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(client.id)}>{t("common.delete")}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("clients.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("clients.nameLabel")}
            placeholder={t("clients.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <Input
            label={t("clients.emailLabel")}
            placeholder={t("clients.emailPlaceholder")}
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            type="email"
            required
          />
          <Input
            label={t("clients.websiteLabel")}
            placeholder={t("clients.websitePlaceholder")}
            value={form.website}
            onChange={(v) => setForm((p) => ({ ...p, website: v }))}
            icon={Globe}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.name || !form.email}>{t("clients.addClient")}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Client Modal */}
      <Modal open={!!editClient} onClose={() => { setEditClient(null); setForm({ name: "", email: "", website: "" }); }} title={t("clients.editTitle") || t("common.edit")}>
        <div className="space-y-4">
          <Input
            label={t("clients.nameLabel")}
            placeholder={t("clients.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <Input
            label={t("clients.emailLabel")}
            placeholder={t("clients.emailPlaceholder")}
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            type="email"
            required
          />
          <Input
            label={t("clients.websiteLabel")}
            placeholder={t("clients.websitePlaceholder")}
            value={form.website}
            onChange={(v) => setForm((p) => ({ ...p, website: v }))}
            icon={Globe}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => { setEditClient(null); setForm({ name: "", email: "", website: "" }); }}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleEdit} disabled={!form.name || !form.email}>{t("common.save") || t("common.edit")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


"use client";
import { useState } from "react";
import { Users2, Plus, Search, Building2, Globe, Mail } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClients } from "@/lib/AppContext";

const statusColors: Record<string, "green" | "blue" | "gray"> = {
  active: "green",
  prospect: "blue",
  inactive: "gray",
};

export default function ClientsPage() {
  const { clients, addClient } = useClients();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
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

  return (
    <div>
      <SectionHeader
        title="Clients"
        subtitle={`${clients.length} total clients`}
        icon={Users2}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>Add Client</Button>}
      />

      <div className="mb-5">
        <Input placeholder="Search clients..." value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="No clients found"
          description="Add your first client or adjust your search."
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>Add Client</Button>}
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
                    <Badge label={client.status} color={statusColors[client.status]} />
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
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{client.projects} active projects</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth>View</Button>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add New Client">
        <div className="space-y-4">
          <Input
            label="Company / Client Name"
            placeholder="e.g. Acme Corp"
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <Input
            label="Email Address"
            placeholder="contact@company.com"
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            type="email"
            required
          />
          <Input
            label="Website"
            placeholder="company.com"
            value={form.website}
            onChange={(v) => setForm((p) => ({ ...p, website: v }))}
            icon={Globe}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.name || !form.email}>Add Client</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

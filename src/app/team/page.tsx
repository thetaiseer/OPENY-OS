"use client";
import { useState } from "react";
import { UserCircle, Plus, Search, Mail, Star } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface Member {
  id: number;
  name: string;
  role: string;
  email: string;
  status: "active" | "away" | "offline";
  initials: string;
  color: string;
  projects: number;
}

const roleColors: Record<string, "blue" | "green" | "yellow" | "purple" | "gray"> = {
  Admin: "blue",
  Designer: "purple",
  Developer: "green",
  Manager: "yellow",
  Analyst: "gray",
};

const initialMembers: Member[] = [
  { id: 1, name: "Alex Chen", role: "Admin", email: "alex@openy.os", status: "active", initials: "AC", color: "#4f8ef7", projects: 5 },
  { id: 2, name: "Sarah Kim", role: "Designer", email: "sarah@openy.os", status: "active", initials: "SK", color: "#a78bfa", projects: 3 },
  { id: 3, name: "Marcus Lee", role: "Developer", email: "marcus@openy.os", status: "away", initials: "ML", color: "#34d399", projects: 7 },
  { id: 4, name: "Priya Nair", role: "Manager", email: "priya@openy.os", status: "active", initials: "PN", color: "#fbbf24", projects: 4 },
  { id: 5, name: "James Wright", role: "Developer", email: "james@openy.os", status: "active", initials: "JW", color: "#34d399", projects: 6 },
  { id: 6, name: "Luna Torres", role: "Analyst", email: "luna@openy.os", status: "offline", initials: "LT", color: "#8888a0", projects: 2 },
];

const statusColors = { active: "#34d399", away: "#fbbf24", offline: "#55556a" };

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "" });

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name || !form.role || !form.email) return;
    const initials = form.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const colors = ["#4f8ef7", "#a78bfa", "#34d399", "#fbbf24", "#f87171"];
    setMembers(prev => [...prev, {
      id: Date.now(),
      name: form.name,
      role: form.role,
      email: form.email,
      status: "active",
      initials,
      color: colors[Math.floor(Math.random() * colors.length)],
      projects: 0,
    }]);
    setForm({ name: "", role: "", email: "" });
    setModalOpen(false);
  };

  return (
    <div>
      <SectionHeader
        title="Team"
        subtitle={`${members.length} members across all roles`}
        icon={UserCircle}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>Add Member</Button>}
      />

      <div className="mb-5">
        <Input placeholder="Search members..." value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="No members found"
          description="Try adjusting your search, or add a new team member."
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>Add Member</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => (
            <Card key={member.id} padding="md">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: member.color }}
                  >
                    {member.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: statusColors[member.status] }}
                      />
                      <span className="text-[11px] capitalize" style={{ color: 'var(--text-muted)' }}>{member.status}</span>
                    </div>
                  </div>
                </div>
                <Badge label={member.role} color={roleColors[member.role] || "gray"} />
              </div>
              
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2">
                  <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star size={12} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{member.projects} active projects</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth>Profile</Button>
                <Button variant="ghost" size="sm" icon={Mail}>Message</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Team Member">
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Jordan Blake"
            value={form.name}
            onChange={v => setForm(p => ({ ...p, name: v }))}
            required
          />
          <Input
            label="Role"
            placeholder="e.g. Developer, Designer..."
            value={form.role}
            onChange={v => setForm(p => ({ ...p, role: v }))}
            required
          />
          <Input
            label="Email Address"
            placeholder="member@company.com"
            value={form.email}
            onChange={v => setForm(p => ({ ...p, email: v }))}
            type="email"
            required
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.name || !form.role || !form.email}>Add Member</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

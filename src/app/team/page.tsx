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
import { useTeam } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";

const roleColors: Record<string, "blue" | "green" | "yellow" | "purple" | "gray"> = {
  Admin: "blue",
  Designer: "purple",
  Developer: "green",
  Manager: "yellow",
  Analyst: "gray",
};

const statusColors = { active: "#34d399", away: "#fbbf24", offline: "#55556a" };

export default function TeamPage() {
  const { members, addMember } = useTeam();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "" });

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name || !form.role || !form.email) return;
    addMember({ name: form.name, role: form.role, email: form.email });
    setForm({ name: "", role: "", email: "" });
    setModalOpen(false);
  };

  return (
    <div>
      <SectionHeader
        title={t("team.title")}
        subtitle={`${members.length} ${t("team.membersCount")}`}
        icon={UserCircle}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("team.addMember")}</Button>}
      />

      <div className="mb-5">
        <Input placeholder={t("team.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title={t("team.noMembersTitle")}
          description={t("team.noMembersDesc")}
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("team.addMember")}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((member) => (
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
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[member.status] }} />
                      <span className="text-[11px] capitalize" style={{ color: "var(--text-muted)" }}>
                        {t(`status.${member.status}`) || member.status}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge label={member.role} color={roleColors[member.role] || "gray"} />
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2">
                  <Mail size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{member.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{member.projects} {t("team.activeProjects")}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth>{t("common.profile")}</Button>
                <Button variant="ghost" size="sm" icon={Mail}>{t("common.message")}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("team.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("team.nameLabel")}
            placeholder={t("team.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <Input
            label={t("team.roleLabel")}
            placeholder={t("team.rolePlaceholder")}
            value={form.role}
            onChange={(v) => setForm((p) => ({ ...p, role: v }))}
            required
          />
          <Input
            label={t("team.emailLabel")}
            placeholder={t("team.emailPlaceholder")}
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            type="email"
            required
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.name || !form.role || !form.email}>{t("team.addMember")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


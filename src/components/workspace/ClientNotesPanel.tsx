"use client";

import { useState } from "react";
import { Lock, Globe, Plus, Trash2, Tag } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { ClientNote, ClientNoteType } from "@/lib/types";

interface ClientNotesPanelProps {
  notes: ClientNote[];
  onAdd: (type: ClientNoteType, content: string, tag?: string) => void;
  onDelete: (id: string) => void;
}

function timeStr(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientNotesPanel({ notes, onAdd, onDelete }: ClientNotesPanelProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<ClientNoteType>("internal");
  const [addModal, setAddModal] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTag, setNewTag] = useState("");

  const filtered = notes.filter((n) => n.type === tab);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    onAdd(tab, newContent.trim(), newTag.trim() || undefined);
    setNewContent("");
    setNewTag("");
    setAddModal(false);
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setTab("internal")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{
            background: tab === "internal" ? "rgba(248,113,113,0.15)" : "var(--surface-2)",
            color: tab === "internal" ? "#f87171" : "var(--text-secondary)",
            border: `1px solid ${tab === "internal" ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
          }}
        >
          <Lock size={11} />
          {t("workspace.internalNotes")}
        </button>
        <button
          onClick={() => setTab("client_facing")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{
            background: tab === "client_facing" ? "var(--accent-dim)" : "var(--surface-2)",
            color: tab === "client_facing" ? "var(--accent)" : "var(--text-secondary)",
            border: `1px solid ${tab === "client_facing" ? "rgba(79,142,247,0.3)" : "var(--border)"}`,
          }}
        >
          <Globe size={11} />
          {t("workspace.clientFacingNotes")}
        </button>

        <div className="flex-1" />

        <Button
          size="sm"
          icon={Plus}
          onClick={() => setAddModal(true)}
        >
          {tab === "internal" ? t("workspace.addInternalNote") : t("workspace.addClientNote")}
        </Button>
      </div>

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 rounded-2xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {t("workspace.noNotes")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <div
              key={note.id}
              className="rounded-2xl p-4"
              style={{
                background: note.type === "internal" ? "rgba(248,113,113,0.05)" : "var(--surface-2)",
                border: `1px solid ${note.type === "internal" ? "rgba(248,113,113,0.2)" : "var(--border)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {note.type === "internal" ? (
                    <Lock size={11} color="#f87171" />
                  ) : (
                    <Globe size={11} color="var(--accent)" />
                  )}
                  <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {note.author}
                  </span>
                  {note.tag && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
                    >
                      <Tag size={9} />
                      {note.tag}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onDelete(note.id)}
                  className="p-1.5 rounded-lg transition-all flex-shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {note.content}
              </p>
              <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
                {timeStr(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add note modal */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title={tab === "internal" ? t("workspace.addInternalNote") : t("workspace.addClientNote")}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("workspace.noteContent")}
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none transition-all"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder={tab === "internal" ? "Strategy notes, warnings, reminders..." : "Safe summaries, updates..."}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("workspace.noteTag")}
            </label>
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="strategy, warning, reminder..."
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setAddModal(false)}>
              {t("common.cancel")}
            </Button>
            <Button fullWidth onClick={handleAdd} disabled={!newContent.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

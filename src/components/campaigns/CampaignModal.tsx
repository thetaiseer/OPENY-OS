"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import type { Campaign, CampaignStatus, ContentPlatform } from "@/lib/types";
import { useCampaigns } from "@/lib/CampaignContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";

const PLATFORMS: ContentPlatform[] = ["Facebook", "Instagram", "TikTok", "LinkedIn", "X", "Snapchat", "YouTube"];
const STATUSES: CampaignStatus[] = ["draft", "planned", "active", "paused", "completed", "archived"];

const STATUS_LABEL_KEYS: Record<CampaignStatus, string> = {
  draft:     "campaigns.statusDraft",
  planned:   "campaigns.statusPlanned",
  active:    "campaigns.statusActive",
  paused:    "campaigns.statusPaused",
  completed: "campaigns.statusCompleted",
  archived:  "campaigns.statusArchived",
};

interface CampaignModalProps {
  open: boolean;
  onClose: () => void;
  campaign?: Campaign | null;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
        {label}{required && <span style={{ color: "var(--error)" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl px-3 py-2 text-sm outline-none transition-all";
const inputStyle = {
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
} as React.CSSProperties;

function TextInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
      style={{ ...inputStyle, ...(focused ? { border: "1px solid var(--accent)" } : {}) }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={inputCls}
      style={{ ...inputStyle, ...(focused ? { border: "1px solid var(--accent)" } : {}), resize: "vertical" }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function SelectInput({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        style={{ ...inputStyle, ...(focused ? { border: "1px solid var(--accent)" } : {}), appearance: "none", paddingRight: "32px", cursor: "pointer" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
    </div>
  );
}

export function CampaignModal({ open, onClose, campaign }: CampaignModalProps) {
  const { t } = useLanguage();
  const { clients } = useAppStore();
  const { createCampaign, updateCampaign } = useCampaigns();

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [objective, setObjective] = useState("");
  const [description, setDescription] = useState("");
  const [platforms, setPlatforms] = useState<ContentPlatform[]>([]);
  const [budget, setBudget] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (campaign) {
      setName(campaign.name);
      setClientId(campaign.clientId);
      setObjective(campaign.objective);
      setDescription(campaign.description);
      setPlatforms(campaign.platforms);
      setBudget(campaign.budget ? String(campaign.budget) : "");
      setTargetAudience(campaign.targetAudience);
      setStartDate(campaign.startDate);
      setEndDate(campaign.endDate);
      setStatus(campaign.status);
      setNotes(campaign.notes);
    } else {
      setName(""); setClientId(""); setObjective(""); setDescription("");
      setPlatforms([]); setBudget(""); setTargetAudience("");
      setStartDate(""); setEndDate(""); setStatus("draft"); setNotes("");
    }
    setError("");
  }, [open, campaign]);

  const togglePlatform = (p: ContentPlatform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { setError(t("campaigns.noTitle")); return; }
    setSaving(true);
    setError("");
    try {
      const data = {
        clientId,
        name: name.trim(),
        objective,
        description,
        platforms,
        budget: budget ? parseFloat(budget) : 0,
        targetAudience,
        startDate,
        endDate,
        status,
        notes,
      };
      if (campaign) {
        await updateCampaign(campaign.id, data);
      } else {
        await createCampaign(data);
      }
      onClose();
    } catch (e) {
      setError("Something went wrong. Please try again.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)", zIndex: 9999, display: "flex",
        alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-1)", border: "1px solid var(--border)",
          borderRadius: "20px", width: "100%", maxWidth: "680px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
            {campaign ? t("campaigns.modalEdit") : t("campaigns.modalCreate")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Field label={t("campaigns.nameLabel")} required>
            <TextInput value={name} onChange={setName} placeholder={t("campaigns.title")} />
          </Field>

          <Field label={t("campaigns.ownerLabel")}>
            <SelectInput value={clientId} onChange={setClientId}>
              <option value="">— Select client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectInput>
          </Field>

          <Field label={t("campaigns.objectiveLabel")}>
            <TextInput value={objective} onChange={setObjective} placeholder={t("campaigns.objectiveLabel")} />
          </Field>

          <Field label={t("campaigns.descLabel")}>
            <Textarea value={description} onChange={setDescription} placeholder={t("campaigns.noDesc")} rows={3} />
          </Field>

          {/* Platforms multi-checkbox */}
          <Field label={t("campaigns.platformsLabel")}>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const selected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selected ? "var(--accent-dim)" : "var(--surface-3)",
                      color: selected ? "var(--accent)" : "var(--text-secondary)",
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("campaigns.budgetLabel")}>
              <TextInput type="number" value={budget} onChange={setBudget} placeholder="0" />
            </Field>
            <Field label={t("campaigns.statusLabel")}>
              <SelectInput value={status} onChange={(v) => setStatus(v as CampaignStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS_LABEL_KEYS[s] as Parameters<typeof t>[0])}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field label={t("campaigns.audienceLabel")}>
            <TextInput value={targetAudience} onChange={setTargetAudience} placeholder={t("campaigns.audienceLabel")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("campaigns.startDateLabel")}>
              <TextInput type="date" value={startDate} onChange={setStartDate} />
            </Field>
            <Field label={t("campaigns.endDateLabel")}>
              <TextInput type="date" value={endDate} onChange={setEndDate} />
            </Field>
          </div>

          <Field label={t("campaigns.notesLabel")}>
            <Textarea value={notes} onChange={setNotes} placeholder={t("campaigns.notesLabel")} rows={2} />
          </Field>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--error)", background: "var(--error)15", border: "1px solid var(--error)33" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ color: "var(--text-secondary)", background: "var(--surface-3)", border: "1px solid var(--border)" }}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "var(--accent)", color: "white", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? t("common.loading") : campaign ? t("campaigns.saveBtn") : t("campaigns.createBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

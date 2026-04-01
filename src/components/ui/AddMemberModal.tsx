"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "./Modal";
import { useTeam } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { useToast } from "@/lib/ToastContext";

const TEAM_ROLES = [
  { value: "account_manager", labelEn: "Account Manager", labelAr: "مدير حساب" },
  { value: "creative",        labelEn: "Creative",         labelAr: "مبدع / مصمم" },
  { value: "admin",           labelEn: "Admin",            labelAr: "مدير النظام" },
];

export function AddMemberModal({ open, onClose }) {
  const { addMember } = useTeam();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { showToast } = useToast();

  const [name, setName]           = useState("");
  const [role, setRole]           = useState("");
  const [teamRole, setTeamRole]   = useState("account_manager");
  const [email, setEmail]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const reset = () => {
    setName("");
    setRole("");
    setTeamRole("account_manager");
    setEmail("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isAr ? "الاسم مطلوب" : "Name is required");
      return;
    }
    if (!role.trim()) {
      setError(isAr ? "الدور مطلوب" : "Role is required");
      return;
    }
    if (!email.trim()) {
      setError(isAr ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await addMember({ name: name.trim(), role: role.trim(), email: email.trim(), teamRole });
      showToast(isAr ? "تمت إضافة العضو بنجاح" : "Member added successfully", "success");
      reset();
      onClose();
    } catch (err) {
      const msg = parseFirestoreError(err, isAr);
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={isAr ? "إضافة موظف جديد" : "Add team member"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label={isAr ? "الاسم الكامل" : "Full name"}
          required
          placeholder={isAr ? "اسم الموظف" : "Member name"}
          value={name}
          onChange={setName} />

        <Field
          label={isAr ? "المسمى الوظيفي" : "Job title"}
          required
          placeholder={isAr ? "مثال: مصمم، مدير محتوى، مطور" : "e.g. Designer, Content Manager, Developer"}
          value={role}
          onChange={setRole} />

        <Field
          label={isAr ? "البريد الإلكتروني" : "Email"}
          required
          type="email"
          placeholder="example@company.com"
          value={email}
          onChange={setEmail} />

        {/* Team role (system permission level) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "صلاحيات النظام" : "System role"}
            <span className="text-[var(--rose)]"> *</span>
          </label>
          <select
            value={teamRole}
            onChange={e => setTeamRole(e.target.value)}
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
            dir={isAr ? "rtl" : "ltr"}
          >
            {TEAM_ROLES.map(r => (
              <option key={r.value} value={r.value}>
                {isAr ? r.labelAr : r.labelEn}
              </option>
            ))}
          </select>
        </div>

        {error ?
          <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">{error}</p>
          : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:opacity-80">
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
            <UserPlus size={16} />
            {loading ? isAr ? "جارٍ الإضافة…" : "Adding…" : isAr ? "إضافة موظف" : "Add member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--muted)]">
        {label}
        {required ? <span className="text-[var(--rose)]"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="glass-input w-full rounded-2xl px-4 py-3 text-sm" />
    </div>
  );
}








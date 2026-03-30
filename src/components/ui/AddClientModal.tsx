"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "./Modal";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddClientModal({ open, onClose }: AddClientModalProps) {
  const { addClient } = useClients();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setPhone("");
    setWebsite("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(isAr ? "الاسم مطلوب" : "Name is required");
      return;
    }
    if (!email.trim()) {
      setError(isAr ? "البريد الإلكتروني مطلوب" : "Email is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await addClient({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, website: website.trim() || undefined });
      reset();
      onClose();
    } catch {
      setError(isAr ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={isAr ? "إضافة عميل جديد" : "Add new client"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label={isAr ? "الاسم" : "Name"}
          required
          placeholder={isAr ? "اسم العميل أو الشركة" : "Client or company name"}
          value={name}
          onChange={setName}
        />
        <Field
          label={isAr ? "البريد الإلكتروني" : "Email"}
          required
          type="email"
          placeholder={isAr ? "example@company.com" : "example@company.com"}
          value={email}
          onChange={setEmail}
        />
        <Field
          label={isAr ? "رقم الهاتف" : "Phone"}
          placeholder={isAr ? "اختياري" : "Optional"}
          value={phone}
          onChange={setPhone}
        />
        <Field
          label={isAr ? "الموقع الإلكتروني" : "Website"}
          placeholder={isAr ? "https://example.com (اختياري)" : "https://example.com (optional)"}
          value={website}
          onChange={setWebsite}
        />

        {error ? (
          <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">{error}</p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:opacity-80"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <UserPlus size={16} />
            {loading ? (isAr ? "جارٍ الإضافة…" : "Adding…") : (isAr ? "إضافة عميل" : "Add client")}
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
        className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
      />
    </div>
  );
}

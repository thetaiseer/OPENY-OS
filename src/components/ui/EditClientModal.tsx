"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Modal } from "./Modal";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Client } from "@/lib/types";

interface EditClientModalProps {
  client: Client | null;
  onClose: () => void;
}

export function EditClientModal({ client, onClose }: EditClientModalProps) {
  const { updateClient } = useClients();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Client["status"]>("prospect");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Populate fields when the target client changes
  useEffect(() => {
    if (client) {
      setName(client.name ?? "");
      setEmail(client.email ?? "");
      setPhone(client.phone ?? "");
      setWebsite(client.website ?? "");
      setStatus(client.status ?? "prospect");
      setError("");
    }
  }, [client]);

  const handleClose = () => {
    setError("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
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
      await updateClient(client.id, {
        name: name.trim(),
        company: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        status,
      });
      onClose();
    } catch {
      setError(isAr ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={client !== null}
      onClose={handleClose}
      title={isAr ? "تعديل بيانات العميل" : "Edit client"}
    >
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
          placeholder="example@company.com"
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
          placeholder="https://example.com"
          value={website}
          onChange={setWebsite}
        />

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "الحالة" : "Status"}
          </label>
          <div className="flex gap-2">
            {(["active", "prospect", "inactive"] as Client["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="flex-1 rounded-2xl border px-3 py-2.5 text-xs font-medium transition"
                style={{
                  borderColor: status === s ? "var(--accent)" : "var(--border)",
                  background:
                    status === s
                      ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                      : "var(--glass-overlay)",
                  color: status === s ? "var(--accent)" : "var(--muted)",
                }}
              >
                {isAr
                  ? s === "active"
                    ? "نشط"
                    : s === "prospect"
                    ? "محتمل"
                    : "غير نشط"
                  : s === "active"
                  ? "Active"
                  : s === "prospect"
                  ? "Prospect"
                  : "Inactive"}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">
            {error}
          </p>
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
            <Save size={16} />
            {loading
              ? isAr
                ? "جارٍ الحفظ…"
                : "Saving…"
              : isAr
              ? "حفظ التغييرات"
              : "Save changes"}
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

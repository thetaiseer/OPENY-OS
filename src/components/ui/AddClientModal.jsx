"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Modal } from "./Modal";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { useToast } from "@/lib/ToastContext";






export function AddClientModal({ open, onClose }) {
  const { addClient } = useClients();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { showToast } = useToast();

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

  const handleSubmit = async (e) => {
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
      showToast(isAr ? "تمت إضافة العميل بنجاح" : "Client added successfully", "success");
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
    <Modal open={open} onClose={handleClose} title={isAr ? "إضافة عميل جديد" : "Add new client"} loading={loading}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label={isAr ? "الاسم" : "Name"}
          required
          placeholder={isAr ? "أدخل اسم العميل" : "Client or company name"}
          value={name}
          onChange={setName} />
        
        <Field
          label={isAr ? "البريد الإلكتروني" : "Email"}
          required
          type="email"
          placeholder={isAr ? "example@company.com" : "example@company.com"}
          value={email}
          onChange={setEmail} />
        
        <Field
          label={isAr ? "رقم الهاتف" : "Phone"}
          optional={isAr ? "(اختياري)" : "(Optional)"}
          placeholder={isAr ? "01xxxxxxxxx" : "Optional"}
          value={phone}
          onChange={setPhone} />
        
        <Field
          label={isAr ? "الموقع الإلكتروني" : "Website"}
          optional={isAr ? "(اختياري)" : "(Optional)"}
          placeholder="https://example.com"
          value={website}
          onChange={setWebsite}
          ltr />
        

        {error ?
        <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">{error}</p> :
        null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
            
            <UserPlus size={16} />
            {loading ? isAr ? "جارٍ الإضافة…" : "Adding…" : isAr ? "إضافة عميل" : "Add client"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60">
            
            {isAr ? "إلغاء" : "Cancel"}
          </button>
        </div>
      </form>
    </Modal>);

}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  optional,
  ltr









}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[var(--text)]">
        {label}
        {required ? <span className="text-[var(--rose)]"> *</span> : null}
        {optional ? <span className="ms-1 text-xs font-normal text-[var(--muted)]">{optional}</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        dir={ltr ? "ltr" : undefined}
        style={ltr ? { textAlign: "right" } : undefined}
        className="glass-input w-full rounded-2xl px-4 py-3 text-sm" />
      
    </div>);

}
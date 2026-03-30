"use client";

import { useState, useRef } from "react";
import type { UserNotificationPreferences } from "@/lib/types";
import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  BellRing,
  Camera,
  Globe,
  KeyRound,
  LogOut,
  MoonStar,
  Shield,
  ShieldCheck,
  SunMedium,
  User,
  UserCog,
} from "lucide-react";
import {
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  pageText,
} from "@/components/redesign/ui";

// ── Notification categories ───────────────────────────────────

const NOTIFICATION_CATEGORIES: Array<{
  key: keyof Omit<UserNotificationPreferences, "id" | "userId" | "updatedAt">;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
}> = [
  { key: "approvals", title: { en: "Approvals", ar: "الموافقات" }, description: { en: "Review and client decision updates", ar: "تحديثات المراجعة وقرارات العميل" } },
  { key: "publishingReminders", title: { en: "Publishing reminders", ar: "تذكيرات النشر" }, description: { en: "Launch windows and publishing timing", ar: "نوافذ الإطلاق وتوقيت النشر" } },
  { key: "taskAlerts", title: { en: "Task alerts", ar: "تنبيهات المهام" }, description: { en: "Assignments and task completion nudges", ar: "إشعارات التعيين وتذكيرات إكمال المهام" } },
  { key: "invitationEmails", title: { en: "Invitations", ar: "الدعوات" }, description: { en: "Invite flow and acceptance events", ar: "أحداث الدعوات والقبول" } },
  { key: "systemAlerts", title: { en: "System alerts", ar: "تنبيهات النظام" }, description: { en: "Workspace health and service signals", ar: "صحة مساحة العمل وإشارات الخدمة" } },
  { key: "clientActions", title: { en: "Client actions", ar: "إجراءات العميل" }, description: { en: "Client approvals, changes, and follow-ups", ar: "موافقات العميل والتعديلات والمتابعات" } },
];

// ── Main Settings Page ───────────────────────────────────────

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { prefs, loading, updateCategory } = useNotificationPreferences();
  const isArabic = language === "ar";

  // Profile state (local form state — saved to Firestore on submit in a real implementation)
  const [displayName, setDisplayName] = useState("Thetaiseer");
  const [email] = useState("thetaiseer@gmail.com");
  const [role, setRole] = useState(isArabic ? "مدير" : "Admin");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleChangePassword = () => {
    setPasswordError("");
    if (!currentPassword) {
      setPasswordError(isArabic ? "أدخل كلمة المرور الحالية" : "Enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(isArabic ? "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" : "New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(isArabic ? "كلمات المرور غير متطابقة" : "Passwords do not match");
      return;
    }
    setPasswordSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  const handleSignOut = () => {
    // In a real implementation, call auth.signOut() from firebase/auth
    if (typeof window !== "undefined") {
      localStorage.removeItem("openy-lang");
      localStorage.removeItem("openy-theme");
      window.location.href = "/";
    }
  };

  // Initials for avatar fallback
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Account & system", "الحساب والنظام")}
        title={pageText("Account settings", "إعدادات الحساب")}
        description={pageText(
          "Manage your profile, security, notifications, and interface preferences.",
          "إدارة ملفك الشخصي والأمان والإشعارات وتفضيلات الواجهة."
        )}
      />

      {/* ── Profile section ──────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title={pageText("Profile information", "معلومات الملف الشخصي")}
          description={pageText("Update your name, role, and avatar.", "حدّث اسمك ودورك وصورتك الشخصية.")}
          action={<InfoBadge label={profileSaved ? (isArabic ? "تم الحفظ ✓" : "Saved ✓") : (isArabic ? "قابل للتعديل" : "Editable")} tone={profileSaved ? "mint" : "slate"} />}
        >
          <div className="space-y-5">
            {/* Avatar row */}
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white overflow-hidden"
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--bg)] text-white transition hover:opacity-90"
                  style={{ background: "var(--accent)" }}
                  aria-label={isArabic ? "تغيير الصورة" : "Change photo"}
                >
                  <Camera size={13} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">{displayName}</p>
                <p className="text-xs text-[var(--muted)]">{email}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 text-xs text-[var(--accent)] hover:underline"
                >
                  {isArabic ? "تغيير الصورة الشخصية" : "Change photo"}
                </button>
              </div>
            </div>

            {/* Form fields */}
            <FormField label={isArabic ? "الاسم الكامل" : "Full name"} icon={User}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder={isArabic ? "أدخل اسمك الكامل" : "Enter your full name"}
              />
            </FormField>

            <FormField label={isArabic ? "البريد الإلكتروني" : "Email address"} icon={UserCog}>
              <input
                type="email"
                value={email}
                readOnly
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm opacity-60 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                {isArabic ? "لتغيير البريد الإلكتروني تواصل مع الدعم" : "Contact support to change your email"}
              </p>
            </FormField>

            <FormField label={isArabic ? "الدور الوظيفي" : "Role"} icon={Shield}>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder={isArabic ? "مثال: مدير، مصمم..." : "e.g. Admin, Designer..."}
              />
            </FormField>

            <button
              type="button"
              onClick={handleSaveProfile}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
            >
              {profileSaved ? (isArabic ? "تم الحفظ ✓" : "Saved ✓") : (isArabic ? "حفظ التغييرات" : "Save changes")}
            </button>
          </div>
        </Panel>

        {/* ── Appearance + Language ─────────────────────── */}
        <Panel
          title={pageText("Interface preferences", "تفضيلات الواجهة")}
          description={pageText("Theme and language controls stored on this device.", "ضوابط المظهر واللغة مخزنة على هذا الجهاز.")}
          action={<InfoBadge label={isArabic ? "محلي للجهاز" : "Device-local"} tone="slate" />}
        >
          <div className="space-y-4">
            <SettingRow
              icon={theme === "dark" ? MoonStar : SunMedium}
              title={isArabic ? "وضع المظهر" : "Theme mode"}
              description={isArabic ? "التبديل بين الوضع الداكن والفاتح" : "Switch between dark and light appearance"}
              control={
                <ToggleButton
                  activeLabel={theme === "dark" ? (isArabic ? "داكن" : "Dark") : (isArabic ? "فاتح" : "Light")}
                  onClick={toggleTheme}
                />
              }
            />
            <SettingRow
              icon={Globe}
              title={isArabic ? "لغة الواجهة" : "Interface language"}
              description={isArabic ? "تبديل كامل بين العربية والإنجليزية مع دعم RTL" : "Full Arabic / English switch with RTL support"}
              control={
                <ToggleButton
                  activeLabel={language === "ar" ? "العربية" : "English"}
                  onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                />
              }
            />
          </div>
        </Panel>
      </section>

      {/* ── Password + Session section ───────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title={pageText("Change password", "تغيير كلمة المرور")}
          description={pageText("Update your account password for security.", "حدّث كلمة مرور حسابك لحماية أفضل.")}
          action={<InfoBadge label={isArabic ? "أمان الحساب" : "Account security"} tone="rose" />}
        >
          <div className="space-y-4">
            <FormField label={isArabic ? "كلمة المرور الحالية" : "Current password"} icon={KeyRound}>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </FormField>

            <FormField label={isArabic ? "كلمة المرور الجديدة" : "New password"} icon={KeyRound}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </FormField>

            <FormField label={isArabic ? "تأكيد كلمة المرور" : "Confirm new password"} icon={KeyRound}>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </FormField>

            {passwordError && (
              <p className="text-sm text-[var(--rose)]">{passwordError}</p>
            )}

            <button
              type="button"
              onClick={handleChangePassword}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition hover:opacity-80 active:scale-[0.98]"
            >
              {passwordSaved ? (isArabic ? "تم تغيير كلمة المرور ✓" : "Password updated ✓") : (isArabic ? "تغيير كلمة المرور" : "Update password")}
            </button>
          </div>
        </Panel>

        {/* ── Session Management ────────────────────────── */}
        <Panel
          title={pageText("Session & access", "الجلسة والوصول")}
          description={pageText("Manage your current session and sign out.", "إدارة جلستك الحالية وتسجيل الخروج.")}
          action={<InfoBadge label={isArabic ? "نشط" : "Active"} tone="mint" />}
        >
          <div className="space-y-4">
            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
                  >
                    <ShieldCheck size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {isArabic ? "الجلسة الحالية" : "Current session"}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {isArabic ? "متصفح · الجهاز الحالي" : "Browser · This device"}
                    </p>
                  </div>
                </div>
                <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: "rgba(61,217,180,0.18)", color: "var(--mint)" }}>
                  {isArabic ? "نشطة" : "Active"}
                </span>
              </div>
            </div>

            <div className="rounded-[20px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                {isArabic ? "معلومات الحساب" : "Account details"}
              </p>
              <div className="space-y-1.5 text-sm">
                <p className="text-[var(--text)]">
                  <span className="text-[var(--muted)]">{isArabic ? "الاسم: " : "Name: "}</span>
                  {displayName}
                </p>
                <p className="text-[var(--text)]">
                  <span className="text-[var(--muted)]">{isArabic ? "البريد: " : "Email: "}</span>
                  {email}
                </p>
                <p className="text-[var(--text)]">
                  <span className="text-[var(--muted)]">{isArabic ? "الدور: " : "Role: "}</span>
                  {role}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-[rgba(255,143,159,0.3)] bg-[rgba(255,143,159,0.08)] px-4 py-3 text-sm font-semibold text-[var(--rose)] transition hover:bg-[rgba(255,143,159,0.14)] active:scale-[0.98]"
            >
              <LogOut size={16} />
              {isArabic ? "تسجيل الخروج" : "Sign out"}
            </button>
          </div>
        </Panel>
      </section>

      {/* ── Notification preferences ──────────────────────── */}
      <Panel
        title={pageText("Notification preferences", "تفضيلات الإشعارات")}
        description={pageText(
          "Control which notifications you receive across all channels.",
          "تحكم في الإشعارات التي تستقبلها عبر جميع القنوات."
        )}
        action={
          <InfoBadge
            label={loading ? (isArabic ? "جارٍ التحميل" : "Loading") : (isArabic ? "محفوظ في Firebase" : "Saved to Firebase")}
            tone={loading ? "amber" : "mint"}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const value = prefs[category.key];
            return (
              <div key={category.key} className="rounded-[20px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BellRing size={15} className="flex-shrink-0 text-[var(--accent)]" />
                  <h3 className="text-sm font-semibold text-[var(--text)]">
                    {isArabic ? category.title.ar : category.title.en}
                  </h3>
                </div>
                <p className="mb-3 text-xs text-[var(--muted)]">
                  {isArabic ? category.description.ar : category.description.en}
                </p>
                <div className="space-y-2">
                  <PreferenceToggle label={isArabic ? "داخل التطبيق" : "In-app"} checked={value.inApp} onChange={(next) => updateCategory(category.key, "inApp", next)} />
                  <PreferenceToggle label={isArabic ? "إشعارات دفع" : "Push"} checked={value.push} onChange={(next) => updateCategory(category.key, "push", next)} />
                  <PreferenceToggle label={isArabic ? "البريد الإلكتروني" : "Email"} checked={value.email} onChange={(next) => updateCategory(category.key, "email", next)} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </PageMotion>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function FormField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
        <Icon size={13} />
        {label}
      </label>
      {children}
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: typeof MoonStar;
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.16),rgba(169,139,255,0.16))] text-[var(--accent)]">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
      </div>
      {control}
    </div>
  );
}

function ToggleButton({ activeLabel, onClick }: { activeLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:opacity-80 active:scale-95"
    >
      {activeLabel}
    </button>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="touch-target flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-2 text-xs text-[var(--text)] transition hover:opacity-80 active:scale-[0.98]"
    >
      <span>{label}</span>
      <span
        className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 transition ${checked ? "justify-end bg-[rgba(61,217,180,0.28)]" : "justify-start bg-[var(--glass-overlay)]"}`}
      >
        <span
          className={`h-5 w-5 rounded-full transition-transform ${checked ? "bg-[var(--mint)]" : "bg-[var(--muted)]"}`}
        />
      </span>
    </button>
  );
}

"use client";

import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";
import { BellRing, Globe, MoonStar, SunMedium } from "lucide-react";
import {
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  pageText } from
"@/components/redesign/ui";
// ── Notification categories ───────────────────────────────────

const NOTIFICATION_CATEGORIES =



[
{ key: "approvals", title: { en: "Approvals", ar: "الموافقات" }, description: { en: "Review and client decision updates", ar: "تحديثات المراجعة وقرارات العميل" } },
{ key: "publishingReminders", title: { en: "Publishing reminders", ar: "تذكيرات النشر" }, description: { en: "Launch windows and publishing timing", ar: "نوافذ الإطلاق وتوقيت النشر" } },
{ key: "taskAlerts", title: { en: "Task alerts", ar: "تنبيهات المهام" }, description: { en: "Assignments and task completion nudges", ar: "إشعارات التعيين وتذكيرات إكمال المهام" } },
{ key: "invitationEmails", title: { en: "Invitations", ar: "الدعوات" }, description: { en: "Invite flow and acceptance events", ar: "أحداث الدعوات والقبول" } },
{ key: "systemAlerts", title: { en: "System alerts", ar: "تنبيهات النظام" }, description: { en: "Workspace health and service signals", ar: "صحة مساحة العمل وإشارات الخدمة" } },
{ key: "clientActions", title: { en: "Client actions", ar: "إجراءات العميل" }, description: { en: "Client approvals, changes, and follow-ups", ar: "موافقات العميل والتعديلات والمتابعات" } }];


// ── Main Settings Page ───────────────────────────────────────

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { prefs, loading, updateCategory } = useNotificationPreferences();
  const isArabic = language === "ar";

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Account & system", "الحساب والنظام")}
        title={pageText("Settings", "الإعدادات")}
        description={pageText(
          "Manage your profile, security, notifications, and interface preferences.",
          "إدارة ملفك الشخصي والأمان والإشعارات وتفضيلات الواجهة."
        )} />
      

      <section>
        {/* Appearance + Language */}
        <Panel
          title={pageText("Interface preferences", "تفضيلات الواجهة")}
          description={pageText("Theme and language — synced across all your devices.", "المظهر واللغة — تُزامَن عبر جميع أجهزتك.")}
          action={<InfoBadge label={isArabic ? "مُزامَن" : "Synced"} tone="mint" />}>
          
          <div className="space-y-4">
            <SettingRow
              icon={theme === "dark" ? MoonStar : SunMedium}
              title={isArabic ? "وضع المظهر" : "Theme mode"}
              description={isArabic ? "التبديل بين الوضع الداكن والفاتح" : "Switch between dark and light appearance"}
              control={
              <ToggleButton
                activeLabel={theme === "dark" ? isArabic ? "داكن" : "Dark" : isArabic ? "فاتح" : "Light"}
                onClick={toggleTheme} />

              } />
            
            <SettingRow
              icon={Globe}
              title={isArabic ? "لغة الواجهة" : "Interface language"}
              description={isArabic ? "تبديل كامل بين العربية والإنجليزية مع دعم RTL" : "Full Arabic / English switch with RTL support"}
              control={
              <ToggleButton
                activeLabel={language === "ar" ? "العربية" : "English"}
                onClick={() => setLanguage(language === "ar" ? "en" : "ar")} />

              } />
            
          </div>
        </Panel>
      </section>


      {/* Notification preferences */}
      <Panel
        title={pageText("Notification preferences", "تفضيلات الإشعارات")}
        description={pageText(
          "Control which notifications you receive across all channels.",
          "تحكم في الإشعارات التي تستقبلها عبر جميع القنوات."
        )}
        action={
        <InfoBadge
          label={loading ? isArabic ? "جارٍ التحميل" : "Loading" : isArabic ? "محفوظ في Firebase" : "Saved to Firebase"}
          tone={loading ? "amber" : "mint"} />

        }>
        
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
              </div>);

          })}
        </div>
      </Panel>
    </PageMotion>);

}

// ── Helpers ────────────────────────────────────────────────────

function SettingRow({
  icon: Icon,
  title,
  description,
  control





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
    </div>);

}

function ToggleButton({ activeLabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:opacity-80 active:scale-95">
      
      {activeLabel}
    </button>);

}

function PreferenceToggle({
  label,
  checked,
  onChange




}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="touch-target flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-2 text-xs text-[var(--text)] transition hover:opacity-80 active:scale-[0.98]">
      
      <span>{label}</span>
      <span
        className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 transition ${checked ? "justify-end bg-[rgba(61,217,180,0.28)]" : "justify-start bg-[var(--glass-overlay)]"}`}>
        
        <span
          className={`h-5 w-5 rounded-full transition-transform ${checked ? "bg-[var(--mint)]" : "bg-[var(--muted)]"}`} />
        
      </span>
    </button>);

}
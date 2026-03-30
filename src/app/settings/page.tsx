"use client";

import type { UserNotificationPreferences } from "@/lib/types";
import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";
import { BellRing, Globe, MoonStar, ShieldCheck, Sparkles } from "lucide-react";
import {
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

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

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { prefs, loading, updateCategory } = useNotificationPreferences();
  const isArabic = language === "ar";

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("System controls", "ضوابط النظام")}
        title={pageText("Settings with live preferences", "إعدادات مع تفضيلات مباشرة")}
        description={pageText(
          "Device-level appearance controls paired with Firebase-backed notification preferences.",
          "ضوابط مظهر على مستوى الجهاز مع تفضيلات إشعارات مدعومة مباشرة من Firebase."
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Theme", "المظهر")} value={theme === "dark" ? (isArabic ? "داكن" : "Dark") : (isArabic ? "فاتح" : "Light")} hint={pageText("Switch instantly in the shell", "يتم التبديل فورًا في الواجهة")} icon={MoonStar} tone="blue" />
        <StatCard label={pageText("Language", "اللغة")} value={language === "ar" ? "العربية" : "English"} hint={pageText("Full RTL and LTR support", "دعم كامل RTL وLTR")} icon={Globe} tone="violet" />
        <StatCard label={pageText("Notification sets", "مجموعات الإشعارات")} value={NOTIFICATION_CATEGORIES.length} hint={pageText("Stored directly in Firebase", "مخزنة مباشرة في Firebase")} icon={BellRing} tone="mint" />
        <StatCard label={pageText("Sync state", "حالة المزامنة")} value={loading ? (isArabic ? "تحميل" : "Loading") : (isArabic ? "متزامن" : "Synced")} hint={pageText("Realtime preferences channel", "قناة تفضيلات فورية")} icon={ShieldCheck} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title={pageText("Experience controls", "ضوابط التجربة")} description={pageText("Personalize the interface presentation instantly.", "خصص عرض الواجهة فورًا.")}
          action={<InfoBadge label={isArabic ? "محلي للجهاز" : "Device-local"} tone="slate" />}>
          <div className="space-y-4">
            <SettingRow
              icon={MoonStar}
              title={isArabic ? "تبديل المظهر" : "Theme mode"}
              description={isArabic ? "التبديل بين الوضع الداكن والفاتح" : "Switch between dark and light appearance"}
              control={<ToggleButton activeLabel={theme === "dark" ? (isArabic ? "داكن" : "Dark") : (isArabic ? "فاتح" : "Light")} onClick={toggleTheme} />}
            />
            <SettingRow
              icon={Globe}
              title={isArabic ? "لغة الواجهة" : "Interface language"}
              description={isArabic ? "تبديل كامل بين العربية والإنجليزية" : "Full Arabic / English switch with RTL support"}
              control={<ToggleButton activeLabel={language === "ar" ? "AR" : "EN"} onClick={() => setLanguage(language === "ar" ? "en" : "ar")} />}
            />
          </div>
        </Panel>

        <Panel title={pageText("Notification preferences", "تفضيلات الإشعارات")} description={pageText("Every toggle below writes directly to Firebase — no local data storage.", "كل زر أدناه يكتب مباشرة إلى Firebase دون تخزين بيانات محلي.")}
          action={<InfoBadge label={loading ? (isArabic ? "جارٍ التحميل" : "Loading") : (isArabic ? "متصل" : "Connected")} tone="mint" />}>
          <div className="space-y-4">
            {NOTIFICATION_CATEGORIES.map((category) => {
              const value = prefs[category.key];
              return (
                <div key={category.key} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">{isArabic ? category.title.ar : category.title.en}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">{isArabic ? category.description.ar : category.description.en}</p>
                    </div>
                    <Sparkles size={16} className="text-[var(--accent)]" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <PreferenceToggle label={isArabic ? "داخل التطبيق" : "In-app"} checked={value.inApp} onChange={(next) => updateCategory(category.key, "inApp", next)} />
                    <PreferenceToggle label={isArabic ? "إشعارات دفع" : "Push"} checked={value.push} onChange={(next) => updateCategory(category.key, "push", next)} />
                    <PreferenceToggle label={isArabic ? "البريد الإلكتروني" : "Email"} checked={value.email} onChange={(next) => updateCategory(category.key, "email", next)} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
    </PageMotion>
  );
}

function SettingRow({ icon: Icon, title, description, control }: { icon: typeof MoonStar; title: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
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
    <button type="button" onClick={onClick} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white/[0.08]">
      {activeLabel}
    </button>
  );
}

function PreferenceToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-[var(--text)] transition hover:bg-white/[0.06]"
    >
      <span>{label}</span>
      <span className={`inline-flex h-7 w-12 items-center rounded-full p-1 transition ${checked ? "justify-end bg-[rgba(61,217,180,0.22)]" : "justify-start bg-white/[0.08]"}`}>
        <span className={`h-5 w-5 rounded-full ${checked ? "bg-[var(--mint)]" : "bg-white/70"}`} />
      </span>
    </button>
  );
}

"use client";
import { useState, useCallback } from "react";
import { Settings2, User, Palette, Bell, Shield, LogOut, ChevronRight, Moon, Sun, Check, Globe, Monitor } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NotificationPreferencesPanel } from "@/components/ui/NotificationPreferencesPanel";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useLanguage, type Language } from "@/lib/LanguageContext";
import { requestPushPermission } from "@/lib/firebase";

// ── localStorage keys ──────────────────────────────────────────
const NOTIF_STORAGE_KEY = "openy_notification_prefs";
const PROFILE_STORAGE_KEY = "openy_profile";
const ACCENT_STORAGE_KEY = "openy_accent";
const SECURITY_STORAGE_KEY = "openy_security";

// ── Helpers ────────────────────────────────────────────────────

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-critical
  }
}

type NotifPrefs = { desktop: boolean; sound: boolean; sync: boolean; email: boolean; push: boolean };
type ProfileData = { name: string; email: string; role: string };
type SecurityData = { twoFactor: boolean; activityLogs: boolean };

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const [active, setActive] = useState("profile");

  // Profile – loaded from localStorage so it persists across reloads
  const [profile, setProfile] = useState<ProfileData>(() => {
    const saved = loadJson<ProfileData>(PROFILE_STORAGE_KEY);
    return saved ?? { name: "", email: "", role: "" };
  });
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = useCallback(() => {
    saveJson(PROFILE_STORAGE_KEY, profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }, [profile]);

  const [notifications, setNotifications] = useState<NotifPrefs>(() => {
    const saved = loadJson<NotifPrefs>(NOTIF_STORAGE_KEY);
    return { desktop: true, sound: false, sync: true, email: true, push: false, ...saved };
  });
  const [pushStatus, setPushStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  // Persist notification preferences whenever they change
  const updateNotifications = useCallback((updater: (prev: NotifPrefs) => NotifPrefs) => {
    setNotifications((prev: NotifPrefs) => {
      const next = updater(prev);
      saveJson(NOTIF_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Security – persisted in localStorage (UI preferences)
  const [security, setSecurity] = useState<SecurityData>(() => {
    const saved = loadJson<SecurityData>(SECURITY_STORAGE_KEY);
    return saved ?? { twoFactor: false, activityLogs: true };
  });

  const updateSecurity = useCallback((updater: (prev: SecurityData) => SecurityData) => {
    setSecurity((prev) => {
      const next = updater(prev);
      saveJson(SECURITY_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Accent color – persisted in localStorage (UI preference)
  const [accent, setAccent] = useState<string>(() => {
    if (typeof window === "undefined") return "#4f8ef7";
    return localStorage.getItem(ACCENT_STORAGE_KEY) ?? "#4f8ef7";
  });

  const handleAccentChange = useCallback((color: string) => {
    setAccent(color);
    saveJson(ACCENT_STORAGE_KEY, color);
  }, []);

  const accents = ["#4f8ef7", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#06b6d4"];

  const sections = [
    { id: "profile", label: t("settings.profile"), icon: User },
    { id: "appearance", label: t("settings.appearance"), icon: Palette },
    { id: "notifications", label: t("settings.notifications"), icon: Bell },
    { id: "security", label: t("settings.security"), icon: Shield },
  ];

  const languages: { value: Language; label: string; nativeLabel: string }[] = [
    { value: "en", label: t("settings.english"), nativeLabel: "English" },
    { value: "ar", label: t("settings.arabic"), nativeLabel: "العربية" },
  ];

  const handlePushToggle = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      updateNotifications((p) => ({ ...p, push: false }));
      return;
    }
    setPushStatus("requesting");
    try {
      const { granted } = await requestPushPermission();
      if (granted) {
        updateNotifications((p) => ({ ...p, push: true }));
        setPushStatus("granted");
      } else {
        updateNotifications((p) => ({ ...p, push: false }));
        setPushStatus("denied");
      }
    } catch {
      setPushStatus("idle");
    }
  }, [updateNotifications]);

  return (
    <div>
      <SectionHeader title={t("settings.title")} subtitle={t("settings.subtitle")} icon={Settings2} />
      
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar nav */}
        <div className="lg:w-56 flex-shrink-0">
          <Card padding="sm">
            <nav className="space-y-0.5">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-start"
                  style={{
                    background: active === id ? 'var(--accent-dim)' : 'transparent',
                    color: active === id ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{label}</span>
                  {active === id && <ChevronRight size={13} className="ms-auto rtl-flip" />}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {active === "profile" && (
            <>
              <Card>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>{t("settings.profileInfo")}</p>
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--accent)' }}
                  >
                    {profile.name ? profile.name.trim().split(" ").filter(n => n.length > 0).map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                  </div>
                  <div>
                    <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{profile.name || t("settings.noName")}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile.role || t("settings.noRole")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <Input label={t("settings.fullNameLabel")} value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} />
                  <Input label={t("settings.emailLabel")} value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} type="email" />
                  <Input label={t("settings.roleLabel")} value={profile.role} onChange={v => setProfile(p => ({ ...p, role: v }))} />
                </div>
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <Button onClick={handleSaveProfile}>
                    {profileSaved ? t("settings.saved") : t("settings.saveChanges")}
                  </Button>
                </div>
              </Card>
            </>
          )}

          {active === "appearance" && (
            <>
              <Card>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>{t("settings.themeMode")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { mode: "dark", icon: Moon, label: t("settings.dark") },
                    { mode: "light", icon: Sun, label: t("settings.light") },
                  ] as const).map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => { if (theme !== mode) toggleTheme(); }}
                      className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all"
                      style={{
                        background: theme === mode ? 'var(--accent-dim)' : 'var(--surface-3)',
                        border: `1.5px solid ${theme === mode ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <Icon size={22} style={{ color: theme === mode ? 'var(--accent)' : 'var(--text-secondary)' }} />
                      <span className="text-xs font-medium" style={{ color: theme === mode ? 'var(--accent)' : 'var(--text-secondary)' }}>{label}</span>
                      {theme === mode && (
                        <div
                          className="absolute top-2 end-2 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--accent)' }}
                        >
                          <Check size={9} color="white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t("settings.languageSection")}</p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{t("settings.languageLabel")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {languages.map(({ value, label, nativeLabel }) => (
                    <button
                      key={value}
                      onClick={() => setLanguage(value)}
                      className="relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
                      style={{
                        background: language === value ? 'var(--accent-dim)' : 'var(--surface-3)',
                        border: `1.5px solid ${language === value ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      <Globe size={20} style={{ color: language === value ? 'var(--accent)' : 'var(--text-secondary)' }} />
                      <span className="text-xs font-semibold" style={{ color: language === value ? 'var(--accent)' : 'var(--text-primary)' }}>{nativeLabel}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                      {language === value && (
                        <div
                          className="absolute top-2 end-2 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--accent)' }}
                        >
                          <Check size={9} color="white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t("settings.accentColor")}</p>
                <div className="flex gap-3">
                  {accents.map(color => (
                    <button
                      key={color}
                      onClick={() => handleAccentChange(color)}
                      className="w-8 h-8 rounded-full transition-all"
                      style={{
                        background: color,
                        outline: accent === color ? `2px solid ${color}` : 'none',
                        outlineOffset: '2px',
                        transform: accent === color ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </Card>
            </>
          )}

          {active === "notifications" && (
            <>
              <Card>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>{t("settings.notificationPrefs")}</p>
                <div className="space-y-5">
                  <Toggle
                    checked={notifications.desktop}
                    onChange={v => updateNotifications(p => ({ ...p, desktop: v }))}
                    label={t("settings.desktopNotifs")}
                    description={t("settings.desktopNotifsDesc")}
                  />
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <Toggle
                    checked={notifications.sound}
                    onChange={v => updateNotifications(p => ({ ...p, sound: v }))}
                    label={t("settings.soundEffects")}
                    description={t("settings.soundEffectsDesc")}
                  />
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <Toggle
                    checked={notifications.sync}
                    onChange={v => updateNotifications(p => ({ ...p, sync: v }))}
                    label={t("settings.cloudSync")}
                    description={t("settings.cloudSyncDesc")}
                  />
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <Toggle
                    checked={notifications.email}
                    onChange={v => updateNotifications(p => ({ ...p, email: v }))}
                    label={t("settings.emailNotifs")}
                    description={t("settings.emailNotifsDesc")}
                  />
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <Toggle
                    checked={notifications.push}
                    onChange={handlePushToggle}
                    label={t("settings.pushNotifs")}
                    description={
                      pushStatus === "denied"
                        ? t("settings.pushDenied")
                        : t("settings.pushNotifsDesc")
                    }
                  />
                  {pushStatus === "denied" && (
                    <p className="text-xs mt-1" style={{ color: "var(--error)" }}>
                      {t("settings.pushDeniedHint")}
                    </p>
                  )}
                </div>
              </Card>

              {/* Per-category notification preferences */}
              <Card>
                <NotificationPreferencesPanel />
              </Card>
            </>
          )}

          {active === "security" && (
            <>
              <Card>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>{t("settings.securitySettings")}</p>
                <div className="space-y-5">
                  <Toggle
                    checked={security.twoFactor}
                    onChange={v => updateSecurity(p => ({ ...p, twoFactor: v }))}
                    label={t("settings.twoFactor")}
                    description={t("settings.twoFactorDesc")}
                  />
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <Toggle
                    checked={security.activityLogs}
                    onChange={v => updateSecurity(p => ({ ...p, activityLogs: v }))}
                    label={t("settings.activityLogging")}
                    description={t("settings.activityLoggingDesc")}
                  />
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{t("settings.activeSessions")}</p>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Monitor size={15} style={{ color: 'var(--text-secondary)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {typeof navigator !== "undefined" && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
                          ? t("settings.mobileDevice")
                          : t("settings.desktopDevice")}
                      </p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                      >
                        {t("settings.current")}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 ms-5" style={{ color: 'var(--text-muted)' }}>
                      {t("settings.currentBrowser")}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="pt-2">
                <Button variant="destructive" icon={LogOut}>{t("settings.signOut")}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

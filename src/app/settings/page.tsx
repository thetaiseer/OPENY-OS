"use client";
import { useState } from "react";
import { Settings2, User, Palette, Bell, Shield, LogOut, ChevronRight, Moon, Sun, Check } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/components/layout/ThemeProvider";

const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
];

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState("profile");
  const [profile, setProfile] = useState({ name: "Alex Chen", email: "alex@openy.os", role: "Administrator" });
  const [notifications, setNotifications] = useState({ desktop: true, sound: false, sync: true, email: true });
  const [security, setSecurity] = useState({ twoFactor: false, activityLogs: true });
  const [accent, setAccent] = useState("#4f8ef7");

  const accents = ["#4f8ef7", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#06b6d4"];

  return (
    <div>
      <SectionHeader title="Settings" subtitle="Manage your account and system preferences" icon={Settings2} />
      
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar nav */}
        <div className="lg:w-56 flex-shrink-0">
          <Card padding="sm">
            <nav className="space-y-0.5">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: active === id ? 'var(--accent-dim)' : 'transparent',
                    color: active === id ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{label}</span>
                  {active === id && <ChevronRight size={13} className="ml-auto" />}
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
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Profile Information</p>
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {profile.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{profile.name}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile.role}</p>
                    <Button variant="ghost" size="sm" className="mt-2">Change Photo</Button>
                  </div>
                </div>
                <div className="space-y-4">
                  <Input label="Full Name" value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} />
                  <Input label="Email Address" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} type="email" />
                  <Input label="Role" value={profile.role} onChange={v => setProfile(p => ({ ...p, role: v }))} />
                </div>
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <Button>Save Changes</Button>
                </div>
              </Card>
            </>
          )}

          {active === "appearance" && (
            <>
              <Card>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Theme Mode</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { mode: "dark", icon: Moon, label: "Dark" },
                    { mode: "light", icon: Sun, label: "Light" },
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
                          className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
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
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Accent Color</p>
                <div className="flex gap-3">
                  {accents.map(color => (
                    <button
                      key={color}
                      onClick={() => setAccent(color)}
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
            <Card>
              <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Notification Preferences</p>
              <div className="space-y-5">
                <Toggle
                  checked={notifications.desktop}
                  onChange={v => setNotifications(p => ({ ...p, desktop: v }))}
                  label="Desktop Notifications"
                  description="Show system notifications on your desktop"
                />
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <Toggle
                  checked={notifications.sound}
                  onChange={v => setNotifications(p => ({ ...p, sound: v }))}
                  label="Sound Effects"
                  description="Play sounds for alerts and actions"
                />
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <Toggle
                  checked={notifications.sync}
                  onChange={v => setNotifications(p => ({ ...p, sync: v }))}
                  label="Cloud Sync"
                  description="Sync settings and data across devices"
                />
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <Toggle
                  checked={notifications.email}
                  onChange={v => setNotifications(p => ({ ...p, email: v }))}
                  label="Email Notifications"
                  description="Receive updates and digests by email"
                />
              </div>
            </Card>
          )}

          {active === "security" && (
            <>
              <Card>
                <p className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Security Settings</p>
                <div className="space-y-5">
                  <Toggle
                    checked={security.twoFactor}
                    onChange={v => setSecurity(p => ({ ...p, twoFactor: v }))}
                    label="Two-Factor Authentication"
                    description="Add an extra layer of security to your account"
                  />
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <Toggle
                    checked={security.activityLogs}
                    onChange={v => setSecurity(p => ({ ...p, activityLogs: v }))}
                    label="Activity Logging"
                    description="Keep detailed logs of account activity"
                  />
                </div>
              </Card>

              <Card>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Active Sessions</p>
                <div className="space-y-3">
                  {[
                    { device: "MacBook Pro", location: "San Francisco, CA", current: true, time: "Now" },
                    { device: "iPhone 15 Pro", location: "San Francisco, CA", current: false, time: "2h ago" },
                  ].map(({ device, location, current, time }) => (
                    <div key={device} className="flex items-center justify-between py-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{device}</p>
                          {current && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                            >
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{location} · {time}</p>
                      </div>
                      {!current && <Button variant="ghost" size="sm">Revoke</Button>}
                    </div>
                  ))}
                </div>
              </Card>

              <div className="pt-2">
                <Button variant="destructive" icon={LogOut}>Sign Out</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

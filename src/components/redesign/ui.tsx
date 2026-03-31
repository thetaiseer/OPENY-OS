"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Inbox, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { ReactNode, useState } from "react";

/* ─── Helpers ─── */
export function pickLocalized(text: { en: string; ar: string }, language: string): string {
  return language === "ar" ? text.ar : text.en;
}

export function pageText(en: string, ar: string): { en: string; ar: string } {
  return { en, ar };
}

type Localizable = string | { en: string; ar: string };

function resolveText(val: Localizable | undefined, language: string): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val === "string") return val;
  return language === "ar" ? val.ar : val.en;
}

/* ─── Page animation wrapper ─── */
export function PageMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Page Header ─── */
interface PageHeaderProps {
  eyebrow: { en: string; ar: string };
  title: { en: string; ar: string };
  description?: { en: string; ar: string };
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  const { language } = useLanguage();
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: 28,
      flexWrap: "wrap",
    }}>
      <div>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--accent)",
          marginBottom: 6,
        }}>
          {pickLocalized(eyebrow, language)}
        </p>
        <h1 style={{
          fontSize: "clamp(1.35rem, 3vw, 1.65rem)",
          fontWeight: 700, letterSpacing: "-0.015em",
          color: "var(--text)", lineHeight: 1.25,
          margin: 0,
        }}>
          {pickLocalized(title, language)}
        </h1>
        {description && (
          <p style={{
            fontSize: 13.5, color: "var(--text-secondary)",
            marginTop: 6, lineHeight: 1.5, margin: "6px 0 0",
          }}>
            {pickLocalized(description, language)}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/* ─── Panel ─── */
interface PanelProps {
  children: ReactNode;
  title?: Localizable;
  subtitle?: Localizable;
  description?: Localizable;
  actions?: ReactNode;
  action?: ReactNode;
  padding?: number | string;
  noPadding?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export function Panel({ children, title, subtitle, description, actions, action, padding = "1.25rem", noPadding, style, className }: PanelProps) {
  const { language } = useLanguage();
  const resolvedTitle = resolveText(title, language);
  const resolvedSubtitle = resolveText(subtitle ?? description, language);
  const resolvedActions = actions ?? action;
  const resolvedPadding = noPadding ? 0 : padding;
  return (
    <div
      className={className}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        ...style,
      }}
    >
      {(resolvedTitle || resolvedActions) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `1rem ${resolvedPadding}`,
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            {resolvedTitle && (
              <h3 style={{
                fontSize: 14, fontWeight: 600, color: "var(--text)",
                margin: 0,
              }}>
                {resolvedTitle}
              </h3>
            )}
            {resolvedSubtitle && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                {resolvedSubtitle}
              </p>
            )}
          </div>
          {resolvedActions && <div style={{ display: "flex", gap: 8 }}>{resolvedActions}</div>}
        </div>
      )}
      <div style={{ padding: resolvedPadding }}>
        {children}
      </div>
    </div>
  );
}

/* ─── StatCard ─── */
type StatCardTone = "blue" | "violet" | "mint" | "amber" | "rose" | "cyan";

interface StatCardProps {
  label: Localizable;
  value: string | number;
  sub?: Localizable;
  hint?: Localizable;
  icon?: React.ElementType;
  tone?: StatCardTone;
  trend?: number;
  href?: string;
  loading?: boolean;
}

const TONE_COLORS = {
  blue:   { bg: "var(--accent-soft)",   color: "var(--accent)",  glow: "rgba(59,130,246,0.25)" },
  violet: { bg: "var(--accent-2-soft)", color: "var(--accent-2)", glow: "rgba(139,92,246,0.25)" },
  mint:   { bg: "var(--mint-soft)",     color: "var(--mint)",    glow: "rgba(16,185,129,0.2)" },
  amber:  { bg: "var(--amber-soft)",    color: "var(--amber)",   glow: "rgba(245,158,11,0.2)" },
  rose:   { bg: "var(--rose-soft)",     color: "var(--rose)",    glow: "rgba(239,68,68,0.2)" },
  cyan:   { bg: "var(--cyan-soft)",     color: "var(--cyan)",    glow: "rgba(6,182,212,0.2)" },
};

export function StatCard({ label, value, sub, hint, icon: Icon, tone = "blue", trend, href, loading }: StatCardProps) {
  const { language } = useLanguage();
  const tc = TONE_COLORS[tone];
  const resolvedLabel = resolveText(label, language) ?? "";
  const resolvedSub = resolveText(sub ?? hint, language);

  if (loading) {
    return (
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "1.25rem",
      }}>
        <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 28, width: "60%" }} />
      </div>
    );
  }

  const sharedStyle = {
    display: "block" as const,
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-card)",
    padding: "1.25rem",
    textDecoration: "none",
    cursor: href ? "pointer" as const : "default" as const,
    transition: "border-color 0.15s, box-shadow 0.15s",
    position: "relative" as const,
    overflow: "hidden" as const,
  };

  const innerContent = (
    <>
      {/* Subtle top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, ${tc.color}60, transparent)`,
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
          textTransform: "uppercase", color: "var(--text-muted)",
          margin: 0,
        }}>
          {resolvedLabel}
        </p>
        {Icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: tc.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon size={16} style={{ color: tc.color }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <span style={{
          fontSize: "clamp(1.5rem, 3vw, 2rem)",
          fontWeight: 700, color: "var(--text)",
          lineHeight: 1, letterSpacing: "-0.02em",
        }}>
          {value}
        </span>
        {trend !== undefined && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 12, fontWeight: 600,
            color: trend > 0 ? "var(--mint)" : trend < 0 ? "var(--rose)" : "var(--text-muted)",
            marginBottom: 3,
          }}>
            {trend > 0 ? <TrendingUp size={13} /> : trend < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {resolvedSub && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, margin: "6px 0 0" }}>
          {resolvedSub}
        </p>
      )}

      {href && (
        <div style={{
          position: "absolute", top: 16, right: 16,
          color: "var(--text-muted)",
          opacity: 0.4,
        }}>
          <ArrowUpRight size={14} />
        </div>
      )}
    </>
  );

  return href ? (
    <Link href={href} style={sharedStyle}>{innerContent}</Link>
  ) : (
    <div style={sharedStyle}>{innerContent}</div>
  );
}

/* ─── MiniAreaChart ─── */
interface MiniAreaChartProps {
  data: number[];
  color?: string;
  height?: number;
  filled?: boolean;
}

export function MiniAreaChart({ data, color = "var(--accent)", height = 48, filled = true }: MiniAreaChartProps) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const h = height;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.85 - h * 0.075,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height, display: "block" }}>
      <defs>
        <linearGradient id={`fill-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && (
        <path
          d={area}
          fill={`url(#fill-${color.replace(/[^a-z0-9]/gi, "")})`}
        />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── BarListChart ─── */
interface BarListItem {
  label: string;
  value: number;
  meta?: string;
  color?: string;
}

interface BarListChartProps {
  items: BarListItem[];
  max?: number;
  showValues?: boolean;
  tone?: "blue" | "violet" | "mint" | "amber" | "rose" | "cyan";
}

export function BarListChart({ items, max, showValues = true, tone }: BarListChartProps) {
  const peak = max ?? Math.max(...items.map(i => i.value), 1);
  const defaultColor = tone ? TONE_COLORS[tone]?.color ?? "var(--accent)" : "var(--accent)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, idx) => {
        const pct = Math.round((item.value / peak) * 100);
        const color = item.color ?? defaultColor;
        return (
          <div key={idx}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 4,
            }}>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>
                {item.label}
              </span>
              {showValues && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                  {item.value}
                  {item.meta && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> {item.meta}</span>}
                </span>
              )}
            </div>
            <div style={{
              height: 5, borderRadius: 9999,
              background: "var(--glass-overlay-border)",
              overflow: "hidden",
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: idx * 0.05, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: 9999, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── EmptyPanel ─── */
interface EmptyPanelProps {
  icon?: React.ElementType;
  title?: Localizable;
  description?: Localizable;
  action?: ReactNode;
}

export function EmptyPanel({ icon: Icon = Inbox, title, description, action }: EmptyPanelProps) {
  const { language } = useLanguage();
  const resolvedTitle = resolveText(title, language);
  const resolvedDescription = resolveText(description, language);
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 12, padding: "3rem 1rem", textAlign: "center",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: "var(--glass-overlay)",
        border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} style={{ color: "var(--text-muted)" }} />
      </div>
      {resolvedTitle && (
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{resolvedTitle}</p>
      )}
      {resolvedDescription && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
          {resolvedDescription}
        </p>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

/* ─── InfoBadge ─── */
interface InfoBadgeProps {
  label: string;
  value?: string | number;
  tone?: "blue" | "violet" | "mint" | "amber" | "rose" | "cyan" | "muted" | "slate";
  dot?: boolean;
}

const BADGE_STYLES = {
  blue:   { bg: "var(--accent-soft)",   color: "#60A5FA" },
  violet: { bg: "var(--accent-2-soft)", color: "#A78BFA" },
  mint:   { bg: "var(--mint-soft)",     color: "#34D399" },
  amber:  { bg: "var(--amber-soft)",    color: "#FCD34D" },
  rose:   { bg: "var(--rose-soft)",     color: "#F87171" },
  cyan:   { bg: "var(--cyan-soft)",     color: "#22D3EE" },
  muted:  { bg: "var(--glass-overlay)", color: "var(--text-secondary)" },
  slate:  { bg: "var(--glass-overlay)", color: "var(--text-secondary)" },
};

export function InfoBadge({ label, value, tone = "muted", dot }: InfoBadgeProps) {
  const bs = BADGE_STYLES[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: bs.bg, color: bs.color,
      borderRadius: 6, padding: "3px 8px",
      fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: bs.color, flexShrink: 0,
        }} />
      )}
      {value !== undefined ? `${label}: ${value}` : label}
    </span>
  );
}

/* ─── KanbanBoard ─── */
interface KanbanColumn {
  id: string;
  title: string;
  items: Array<{
    id: string;
    title?: string;
    platform?: string;
    status?: string;
    scheduledFor?: string;
    clientId?: string;
    caption?: string;
    contentType?: string;
    priority?: string;
    [key: string]: unknown;
  }>;
}

interface KanbanBoardProps {
  columns: KanbanColumn[];
  renderItem?: (item: KanbanColumn["items"][number]) => ReactNode;
}

const STATUS_TONE: Record<string, "blue" | "violet" | "mint" | "amber" | "rose" | "cyan" | "muted" | "slate"> = {
  idea:              "muted",
  draft:             "muted",
  copywriting:       "blue",
  design:            "violet",
  in_progress:       "blue",
  internal_review:   "amber",
  client_review:     "amber",
  approved:          "mint",
  scheduled:         "cyan",
  publishing_ready:  "cyan",
  published:         "mint",
};

export function KanbanBoard({ columns, renderItem }: KanbanBoardProps) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`,
      gap: 12,
      overflowX: "auto",
    }}>
      {columns.map(col => (
        <div key={col.id} style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "12px",
          minHeight: 120,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {col.title}
            </h4>
            <span style={{
              fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
              background: "var(--glass-overlay)",
              borderRadius: 6, padding: "1px 7px",
            }}>
              {col.items.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {col.items.map((item, idx) => (
              renderItem ? (
                <div key={item.id ?? idx}>{renderItem(item)}</div>
              ) : (
              <div key={item.id ?? idx} style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 10px",
              }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: "0 0 4px" }}>
                  {item.title ?? "Untitled"}
                </p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {item.platform && (
                    <InfoBadge label={item.platform} tone="blue" />
                  )}
                  {item.status && (
                    <InfoBadge label={item.status} tone={STATUS_TONE[item.status] ?? "muted"} />
                  )}
                </div>
              </div>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ButtonLink (legacy) ─── */
interface ButtonLinkProps {
  href: string;
  label: { en: string; ar: string };
  tone?: "blue" | "violet" | "mint" | "amber" | "rose" | "cyan";
}

const BUTTON_TONE_COLORS = {
  blue:   { bg: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)", color: "#fff", border: "none" },
  violet: { bg: "var(--accent-2-soft)", color: "var(--accent-2)", border: "1px solid rgba(99,102,241,0.2)" },
  mint:   { bg: "var(--mint-soft)",     color: "var(--mint)",    border: "1px solid rgba(16,185,129,0.2)" },
  amber:  { bg: "var(--amber-soft)",    color: "var(--amber)",   border: "1px solid rgba(245,158,11,0.2)" },
  rose:   { bg: "var(--rose-soft)",     color: "var(--rose)",    border: "1px solid rgba(239,68,68,0.2)" },
  cyan:   { bg: "var(--cyan-soft)",     color: "var(--cyan)",    border: "1px solid rgba(6,182,212,0.2)" },
};

export function ButtonLink({ href, label, tone = "blue" }: ButtonLinkProps) {
  const { language } = useLanguage();
  const tc = BUTTON_TONE_COLORS[tone];
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 16px", borderRadius: "var(--radius-btn)",
        fontSize: 13, fontWeight: 600,
        background: tc.bg, color: tc.color,
        border: tc.border,
        textDecoration: "none",
        transition: "opacity 0.15s",
      }}
    >
      {pickLocalized(label, language)}
      <ArrowUpRight size={14} />
    </Link>
  );
}

/* ─── SegmentedControl (legacy) ─── */
interface SegmentedControlProps {
  value: string;
  options: Array<{ value: string; label: { en: string; ar: string } }>;
  onChange: (value: string) => void;
}

export function SegmentedControl({ value, options, onChange }: SegmentedControlProps) {
  const { language } = useLanguage();
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: 4, borderRadius: 9999,
      background: "var(--glass-overlay)",
      border: "1px solid var(--border)",
    }}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              padding: "6px 16px", borderRadius: 9999, border: "none",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: active ? "var(--panel)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-muted)",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              transition: "all 0.15s",
            }}
          >
            {pickLocalized(option.label, language)}
          </button>
        );
      })}
    </div>
  );
}

/* ─── DonutChart (legacy) ─── */
interface DonutChartProps {
  value: number;
  total: number;
  tone?: "blue" | "violet" | "mint" | "amber" | "rose" | "cyan";
  label?: string;
}

export function DonutChart({ value, total, tone = "mint", label }: DonutChartProps) {
  const color = TONE_COLORS[tone]?.color ?? "var(--accent)";
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(value / safeTotal, 1);
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - circumference * ratio;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 144, height: 144 }}>
      <svg viewBox="0 0 100 100" style={{ width: 144, height: 144, transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
          {Math.round(ratio * 100)}%
        </div>
        {label && (
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CalendarHeatmap (legacy) ─── */
interface CalendarHeatmapProps {
  entries: Array<{ date: string; value: number }>;
}

export function CalendarHeatmap({ entries }: CalendarHeatmapProps) {
  const map = new Map(entries.map(e => [e.date, e.value]));
  const start = new Date();
  start.setDate(1);
  const month = start.getMonth();
  const firstWeekday = start.getDay();
  start.setDate(start.getDate() - firstWeekday);
  const days = Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { key, date, value: map.get(key) ?? 0, currentMonth: date.getMonth() === month };
  });
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 6, minWidth: 280,
      }}>
        {days.map(day => {
          const level = Math.min(day.value as number, 4);
          return (
            <div
              key={day.key}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                borderRadius: 10, border: "1px solid var(--border)",
                padding: "6px 4px",
                background: "var(--glass-overlay)",
              }}
            >
              <div style={{
                fontSize: 10, fontWeight: 500, lineHeight: 1,
                color: day.currentMonth ? "var(--text)" : "var(--text-muted)",
              }}>
                {day.date.getDate()}
              </div>
              <div style={{
                height: 20, width: "100%", borderRadius: 6,
                background: level === 0
                  ? "var(--border)"
                  : `rgba(59, 130, 246, ${0.15 + level * 0.18})`,
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── MetricList (legacy) ─── */
interface MetricListItem {
  label: string;
  value: string | number;
}

interface MetricListProps {
  items: MetricListItem[];
}

export function MetricList({ items }: MetricListProps) {
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            borderRadius: 10, border: "1px solid var(--border)",
            padding: "10px 14px",
            background: "var(--glass-overlay)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
            {item.label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

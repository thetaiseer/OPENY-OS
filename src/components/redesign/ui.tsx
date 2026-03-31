"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Inbox, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { ReactNode } from "react";

export type Localized = { en: string; ar: string };

type Tone = "blue" | "violet" | "mint" | "amber" | "rose" | "slate";

const TONE_STYLES: Record<
  Tone,
  { accent: string; bg: string; border: string; text: string }
> = {
  blue: {
    accent: "var(--accent)",
    bg: "var(--accent-soft)",
    border: "rgba(37,99,235,0.2)",
    text: "var(--accent)",
  },
  violet: {
    accent: "var(--accent-2)",
    bg: "var(--accent-2-soft)",
    border: "rgba(99,102,241,0.2)",
    text: "var(--accent-2)",
  },
  mint: {
    accent: "var(--mint)",
    bg: "var(--mint-soft)",
    border: "rgba(16,185,129,0.2)",
    text: "var(--mint)",
  },
  amber: {
    accent: "var(--amber)",
    bg: "var(--amber-soft)",
    border: "rgba(245,158,11,0.2)",
    text: "var(--amber)",
  },
  rose: {
    accent: "var(--rose)",
    bg: "var(--rose-soft)",
    border: "rgba(239,68,68,0.2)",
    text: "var(--rose)",
  },
  slate: {
    accent: "var(--muted)",
    bg: "var(--glass-overlay)",
    border: "var(--border)",
    text: "var(--muted)",
  },
};

export function pickLocalized(text: Localized, language: "en" | "ar"): string {
  return language === "ar" ? text.ar : text.en;
}

export function pageText(en: string, ar: string): Localized {
  return { en, ar };
}

/* ── Page animation wrapper ── */
export function PageMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

/* ── Page Header ── */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: Localized;
  title: Localized;
  description: Localized;
  actions?: ReactNode;
}) {
  const { language } = useLanguage();
  const eyebrowText = pickLocalized(eyebrow, language);
  const titleText = pickLocalized(title, language);
  const descriptionText = pickLocalized(description, language);

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
          {eyebrowText}
        </div>
        <h1
          className="font-bold tracking-tight"
          style={{ color: "var(--text)", fontSize: "clamp(24px,4vw,32px)", lineHeight: "1.2" }}
        >
          {titleText}
        </h1>
        <p
          className="hidden max-w-2xl text-sm leading-relaxed sm:block"
          style={{ color: "var(--muted)" }}
        >
          {descriptionText}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </section>
  );
}

/* ── Panel / Card ── */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  noPadding = false,
}: {
  title?: Localized;
  description?: Localized;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  const { language } = useLanguage();
  const titleText = title ? pickLocalized(title, language) : null;
  const descriptionText = description ? pickLocalized(description, language) : null;

  return (
    <section
      className={`overflow-hidden rounded-2xl border ${className}`.trim()}
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      {(titleText || descriptionText || action) && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="space-y-0.5">
            {titleText ? (
              <h2 className="text-sm font-semibold sm:text-base" style={{ color: "var(--text)" }}>
                {titleText}
              </h2>
            ) : null}
            {descriptionText ? (
              <p className="hidden text-xs sm:block" style={{ color: "var(--muted)" }}>
                {descriptionText}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
      )}
      <div className={noPadding ? "" : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}

/* ── Button Link ── */
export function ButtonLink({
  href,
  label,
  tone = "blue",
}: {
  href: string;
  label: Localized;
  tone?: Tone;
}) {
  const { language } = useLanguage();
  const text = pickLocalized(label, language);
  const colors = TONE_STYLES[tone];

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm"
      style={{
        background: tone === "blue"
          ? "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)"
          : colors.bg,
        borderRadius: "var(--radius-btn)",
        color: tone === "blue" ? "#ffffff" : colors.text,
        border: tone === "blue" ? "none" : `1px solid ${colors.border}`,
      }}
    >
      {text}
      <ArrowUpRight size={14} />
    </Link>
  );
}

/* ── Stat Card ── */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: Localized;
  value: string | number;
  hint: Localized;
  icon: LucideIcon;
  tone?: Tone;
}) {
  const { language } = useLanguage();
  const labelText = pickLocalized(label, language);
  const hintText = pickLocalized(hint, language);
  const colors = TONE_STYLES[tone];

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "var(--shadow-md)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.16 }}
      className="relative overflow-hidden rounded-2xl border p-5"
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Gradient overlay top-left */}
      <div
        className="pointer-events-none absolute left-0 top-0 h-24 w-24 rounded-br-full"
        style={{ background: `radial-gradient(circle at 0% 0%, ${colors.bg} 0%, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            {labelText}
          </p>
          <p className="font-bold tracking-tight" style={{ color: "var(--text)", fontSize: "clamp(28px,3vw,32px)", lineHeight: "1" }}>
            {value}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {hintText}
          </p>
        </div>
        <span
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center"
          style={{ background: colors.bg, color: colors.accent, borderRadius: "12px" }}
        >
          <Icon size={20} />
        </span>
      </div>
    </motion.div>
  );
}

/* ── Segmented Control (pill tabs) ── */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: Localized }>;
  onChange: (value: T) => void;
}) {
  const { language } = useLanguage();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{
        background: "var(--glass-overlay)",
        border: "1px solid var(--border)",
      }}
    >
      {options.map((option) => {
        const label = pickLocalized(option.label, language);
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-150"
            style={{
              background: active ? "var(--panel)" : "transparent",
              color: active ? "var(--accent)" : "var(--muted)",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Mini Area Chart ── */
export function MiniAreaChart({
  values,
  tone = "blue",
}: {
  values: number[];
  tone?: Tone;
}) {
  const colors = TONE_STYLES[tone];
  const safeValues = values.length > 1 ? values : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);
  const points = safeValues
    .map((value, index) => {
      const x = (index / (safeValues.length - 1)) * 100;
      const y = 100 - (value / max) * 88;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,100 ${points} 100,100`;

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-full overflow-visible">
      <defs>
        <linearGradient id={`area-${tone}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colors.accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={`M ${area.replace(/ /g, " L ")} Z`}
        fill={`url(#area-${tone})`}
      />
      <polyline
        fill="none"
        stroke={colors.accent}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

/* ── Bar List Chart ── */
export function BarListChart({
  items,
  tone = "violet",
}: {
  items: Array<{ label: string; value: number; meta?: string }>;
  tone?: Tone;
}) {
  const colors = TONE_STYLES[tone];
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.max((item.value / max) * 100, item.value > 0 ? 10 : 0);
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium" style={{ color: "var(--text)" }}>
                  {item.label}
                </div>
                {item.meta ? (
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {item.meta}
                  </div>
                ) : null}
              </div>
              <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>
                {item.value}
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "var(--glass-overlay)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${colors.accent}, ${colors.bg})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Donut Chart ── */
export function DonutChart({
  value,
  total,
  tone = "mint",
  label,
}: {
  value: number;
  total: number;
  tone?: Tone;
  label: string;
}) {
  const colors = TONE_STYLES[tone];
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(value / safeTotal, 1);
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - circumference * ratio;

  return (
    <div className="relative flex h-40 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={colors.accent}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {Math.round(ratio * 100)}%
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── Calendar Heatmap ── */
export function CalendarHeatmap({
  entries,
}: {
  entries: Array<{ date: string; value: number }>;
}) {
  const map = new Map(entries.map((entry) => [entry.date, entry.value]));
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
    <div
      className="-mx-1 overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label="Publishing calendar"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.currentTarget as HTMLElement).scrollLeft += 80;
        if (e.key === "ArrowLeft") (e.currentTarget as HTMLElement).scrollLeft -= 80;
      }}
    >
      <div className="grid min-w-[280px] grid-cols-7 gap-1.5 px-1">
        {days.map((day) => {
          const level = Math.min(day.value, 4);
          return (
            <div
              key={day.key}
              className="flex flex-col items-center gap-1 rounded-xl border p-2"
              style={{
                borderColor: "var(--border)",
                background: "var(--glass-overlay)",
              }}
            >
              <div
                className="text-[10px] leading-none font-medium"
                style={{ color: day.currentMonth ? "var(--text)" : "var(--text-muted)" }}
              >
                {day.date.getDate()}
              </div>
              <div
                className="h-5 w-full rounded-lg transition-all"
                style={{
                  background:
                    level === 0
                      ? "var(--border)"
                      : `rgba(37, 99, 235, ${0.15 + level * 0.18})`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Kanban Board ── */
const COLUMN_ACCENTS = ["var(--accent)", "var(--accent-2)", "var(--mint)", "var(--amber)"];

export function KanbanBoard<T extends { id: string }>({
  columns,
  renderItem,
}: {
  columns: Array<{ id: string; title: string; items: T[] }>;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div
      className="-mx-5 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:px-6"
      tabIndex={0}
      role="region"
      aria-label="Kanban board"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.currentTarget as HTMLElement).scrollLeft += 120;
        if (e.key === "ArrowLeft") (e.currentTarget as HTMLElement).scrollLeft -= 120;
      }}
    >
      <div
        className="flex gap-4 xl:grid xl:grid-cols-4"
        style={{ minWidth: `${columns.length * 260}px` }}
      >
        {columns.map((column, idx) => {
          const accent = COLUMN_ACCENTS[idx % COLUMN_ACCENTS.length];
          return (
            <div
              key={column.id}
              className="w-[260px] flex-shrink-0 rounded-2xl border xl:w-auto"
              style={{
                background: "var(--glass-overlay)",
                borderColor: "var(--border)",
                borderTop: `3px solid ${accent}`,
              }}
            >
              <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
                <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {column.title}
                </div>
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                  style={{ background: accent, color: "#ffffff" }}
                >
                  {column.items.length}
                </span>
              </div>
              <div className="space-y-2.5 px-4 pb-4">
                {column.items.map((item) => (
                  <div key={item.id}>{renderItem(item)}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Info Badge ── */
export function InfoBadge({ label, tone = "slate" }: { label: string; tone?: Tone }) {
  const colors = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: "11px",
      }}
    >
      {label}
    </span>
  );
}

/* ── Empty Panel ── */
export function EmptyPanel({
  title,
  description,
}: {
  title: Localized;
  description: Localized;
}) {
  const { language } = useLanguage();
  const titleText = pickLocalized(title, language);
  const descriptionText = pickLocalized(description, language);

  return (
    <div
      className="rounded-2xl border-2 border-dashed p-10 text-center"
      style={{ borderColor: "var(--border)" }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--accent-2-soft) 100%)",
        }}
      >
        <Inbox size={22} style={{ color: "var(--accent)" }} />
      </div>
      <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
        {titleText}
      </h3>
      <p
        className="mx-auto mt-2 max-w-xs text-sm leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        {descriptionText}
      </p>
    </div>
  );
}

/* ── Metric List ── */
export function MetricList({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border px-4 py-3"
          style={{
            background: "var(--glass-overlay)",
            borderColor: "var(--border)",
          }}
        >
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            {item.label}
          </div>
          <div className="mt-1.5 text-xl font-bold" style={{ color: "var(--text)" }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Detail Row ── */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm"
      style={{
        background: "var(--glass-overlay)",
        borderColor: "var(--border)",
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="font-medium" style={{ color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}


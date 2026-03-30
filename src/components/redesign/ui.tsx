"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { ReactNode } from "react";

export type Localized = { en: string; ar: string };

type Tone = "blue" | "violet" | "mint" | "amber" | "rose" | "slate";

const TONE_STYLES: Record<Tone, { accent: string; soft: string; border: string }> = {
  blue: { accent: "#6aa8ff", soft: "rgba(106,168,255,0.18)", border: "rgba(106,168,255,0.28)" },
  violet: { accent: "#a98bff", soft: "rgba(169,139,255,0.18)", border: "rgba(169,139,255,0.28)" },
  mint: { accent: "#3dd9b4", soft: "rgba(61,217,180,0.18)", border: "rgba(61,217,180,0.28)" },
  amber: { accent: "#ffbf66", soft: "rgba(255,191,102,0.18)", border: "rgba(255,191,102,0.28)" },
  rose: { accent: "#ff8f9f", soft: "rgba(255,143,159,0.18)", border: "rgba(255,143,159,0.28)" },
  slate: { accent: "#97a3bd", soft: "rgba(151,163,189,0.16)", border: "rgba(151,163,189,0.22)" },
};

export function pickLocalized(text: Localized, language: "en" | "ar"): string {
  return language === "ar" ? text.ar : text.en;
}

export function pageText(en: string, ar: string): Localized {
  return { en, ar };
}

export function PageMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

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
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="space-y-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--muted)] sm:px-4 sm:py-1.5 sm:text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {eyebrowText}
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-3xl lg:text-4xl">
            {titleText}
          </h1>
          <p className="hidden max-w-3xl text-sm leading-7 text-[var(--muted)] sm:block sm:text-base">
            {descriptionText}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: Localized;
  description?: Localized;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { language } = useLanguage();
  const titleText = title ? pickLocalized(title, language) : null;
  const descriptionText = description ? pickLocalized(description, language) : null;

  return (
    <section className={`glass-panel overflow-hidden rounded-[28px] border border-[var(--border)] ${className}`.trim()}>
      {(titleText || descriptionText || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-6">
          <div className="space-y-1">
            {titleText ? <h2 className="text-sm font-semibold text-[var(--text)] sm:text-base">{titleText}</h2> : null}
            {descriptionText ? <p className="hidden text-sm text-[var(--muted)] sm:block">{descriptionText}</p> : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function ButtonLink({ href, label, tone = "blue" }: { href: string; label: Localized; tone?: Tone }) {
  const { language } = useLanguage();
  const text = pickLocalized(label, language);
  const colors = TONE_STYLES[tone];

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-200 hover:-translate-y-0.5"
      style={{ background: colors.soft, borderColor: colors.border, color: colors.accent }}
    >
      {text}
      <ArrowUpRight size={16} />
    </Link>
  );
}

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
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="glass-panel rounded-[26px] border border-[var(--border)] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">{labelText}</span>
          <div className="space-y-1">
            <div className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-3xl">{value}</div>
            <p className="text-xs text-[var(--muted)] sm:text-sm">{hintText}</p>
          </div>
        </div>
        <span
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border sm:h-12 sm:w-12"
          style={{ background: colors.soft, borderColor: colors.border, color: colors.accent }}
        >
          <Icon size={20} />
        </span>
      </div>
    </motion.div>
  );
}

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
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] p-1.5 backdrop-blur-xl">
      {options.map((option) => {
        const label = pickLocalized(option.label, language);
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="rounded-xl px-4 py-2 text-sm font-medium transition duration-200"
            style={{
              background: active ? "linear-gradient(135deg, rgba(106,168,255,0.25), rgba(169,139,255,0.22))" : "transparent",
              color: active ? "var(--text)" : "var(--muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function MiniAreaChart({ values, tone = "blue" }: { values: number[]; tone?: Tone }) {
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
          <stop offset="0%" stopColor={colors.accent} stopOpacity="0.38" />
          <stop offset="100%" stopColor={colors.accent} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`M ${area.replace(/ /g, " L ")} Z`} fill={`url(#area-${tone})`} />
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
    <div className="space-y-4">
      {items.map((item) => {
        const width = Math.max((item.value / max) * 100, item.value > 0 ? 12 : 0);
        return (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <div className="truncate text-[var(--text)]">{item.label}</div>
                {item.meta ? <div className="text-xs text-[var(--muted)]">{item.meta}</div> : null}
              </div>
              <span className="text-xs font-semibold text-[var(--muted)]">{item.value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background: `linear-gradient(90deg, ${colors.accent}, ${colors.soft})`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({ value, total, tone = "mint", label }: { value: number; total: number; tone?: Tone; label: string }) {
  const colors = TONE_STYLES[tone];
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(value / safeTotal, 1);
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - circumference * ratio;

  return (
    <div className="relative flex h-40 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
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
        <div className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">{Math.round(ratio * 100)}%</div>
        <div className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{label}</div>
      </div>
    </div>
  );
}

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
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="region"
      aria-label="Publishing calendar — scroll horizontally on small screens"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.currentTarget as HTMLElement).scrollLeft += 80;
        if (e.key === "ArrowLeft") (e.currentTarget as HTMLElement).scrollLeft -= 80;
      }}
    >
      <div className="grid min-w-[280px] grid-cols-7 gap-1.5 px-1">
        {days.map((day) => {
          const level = Math.min(day.value, 4);
          return (
            <div key={day.key} className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--glass-overlay)] p-2 text-center">
              <div className={`text-[10px] leading-none ${day.currentMonth ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>{day.date.getDate()}</div>
              <div
                className="mx-auto h-5 w-full rounded-lg"
                style={{
                  background:
                    level === 0
                      ? "var(--glass-overlay)"
                      : `linear-gradient(180deg, rgba(106,168,255,${0.18 + level * 0.16}), rgba(169,139,255,${0.12 + level * 0.16}))`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="region"
      aria-label="Kanban board — scroll horizontally on small screens"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.currentTarget as HTMLElement).scrollLeft += 120;
        if (e.key === "ArrowLeft") (e.currentTarget as HTMLElement).scrollLeft -= 120;
      }}
    >
      <div className="flex gap-4 xl:grid xl:grid-cols-4" style={{ minWidth: `${columns.length * 260}px` }}>
        {columns.map((column) => (
          <div key={column.id} className="glass-panel w-[260px] flex-shrink-0 rounded-[24px] border border-[var(--border)] p-4 xl:w-auto">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">{column.title}</div>
                <div className="text-xs text-[var(--muted)]">{column.items.length}</div>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            </div>
            <div className="space-y-3">{column.items.map((item) => <div key={item.id}>{renderItem(item)}</div>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InfoBadge({ label, tone = "slate" }: { label: string; tone?: Tone }) {
  const colors = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
      style={{ background: colors.soft, borderColor: colors.border, color: colors.accent }}
    >
      {label}
    </span>
  );
}

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
    <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--glass-overlay)] p-8 text-center">
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-[var(--glass-overlay)]" />
      <h3 className="text-lg font-semibold text-[var(--text)]">{titleText}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--muted)]">{descriptionText}</p>
    </div>
  );
}

export function MetricList({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{item.label}</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text)]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right text-[var(--text)]">{value}</span>
    </div>
  );
}

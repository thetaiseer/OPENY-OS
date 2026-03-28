"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import { PLATFORM_COLORS, STATUS_COLORS, isOverdue } from "./contentUtils";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";

type CalendarView = "month" | "week" | "day";

interface ContentCalendarProps {
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
}

// ── Helpers ───────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0=Sun
  r.setDate(r.getDate() - ((day + 6) % 7)); // Monday
  r.setHours(0, 0, 0, 0);
  return r;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ── Mini event chip ───────────────────────────────────────────

function EventChip({
  item,
  onClick,
}: {
  item: ContentItem;
  onClick: () => void;
}) {
  const overdue = isOverdue(item.scheduledDate) && item.status !== "published";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate transition-all"
      style={{
        background: PLATFORM_COLORS[item.platform] + "22",
        color: overdue ? "var(--error)" : PLATFORM_COLORS[item.platform],
        border: `1px solid ${PLATFORM_COLORS[item.platform]}44`,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >
      {item.platform.slice(0, 2)} · {item.title}
    </button>
  );
}

// ── Month view ────────────────────────────────────────────────

function MonthView({
  currentDate,
  items,
  onItemClick,
  onDateClick,
  onDrop,
}: {
  currentDate: Date;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
  onDateClick: (date: Date) => void;
  onDrop: (itemId: string, date: string) => void;
}) {
  const { isRTL } = useLanguage();
  const [dragOver, setDragOver] = useState<string | null>(null);

  const today = isoDate(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = startOfMonth(currentDate);
  // Offset so week starts Monday
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = daysInMonth(year, month);

  const dayHeaders = isRTL
    ? ["أح", "سب", "جم", "خم", "أر", "ثل", "إث"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const itemsByDate = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    items.forEach((item) => {
      if (!item.scheduledDate) return;
      if (!map[item.scheduledDate]) map[item.scheduledDate] = [];
      map[item.scheduledDate].push(item);
    });
    return map;
  }, [items]);

  // Build grid: 6 weeks × 7 days
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium py-1" style={{ color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-px" style={{ background: "var(--border)" }}>
        {cells.map((date, idx) => {
          const dateStr = date ? isoDate(date) : "";
          const dayItems = dateStr ? (itemsByDate[dateStr] ?? []) : [];
          const isToday = dateStr === today;
          const isCurrentMonth = date ? date.getMonth() === month : false;

          return (
            <div
              key={idx}
              className="min-h-[90px] p-1.5 flex flex-col gap-1 transition-all"
              style={{
                background: dragOver === dateStr ? "var(--surface-3)" : "var(--surface-1)",
                cursor: date ? "pointer" : "default",
                opacity: !isCurrentMonth ? 0.4 : 1,
              }}
              onClick={() => date && onDateClick(date)}
              onDragOver={(e) => { if (date) { e.preventDefault(); setDragOver(dateStr); } }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("contentItemId");
                setDragOver(null);
                if (id && dateStr) onDrop(id, dateStr);
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full"
                  style={{
                    color: isToday ? "white" : "var(--text-primary)",
                    background: isToday ? "var(--accent)" : "transparent",
                    fontSize: "11px",
                  }}
                >
                  {date?.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <EventChip key={item.id} item={item} onClick={() => onItemClick(item)} />
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[9px] px-1" style={{ color: "var(--text-muted)" }}>
                    +{dayItems.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────

function WeekView({
  currentDate,
  items,
  onItemClick,
  onDrop,
}: {
  currentDate: Date;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
  onDrop: (itemId: string, date: string) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { isRTL } = useLanguage();
  const today = isoDate(new Date());
  const monday = startOfWeek(currentDate);

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const itemsByDate = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};
    items.forEach((item) => {
      if (!item.scheduledDate) return;
      if (!map[item.scheduledDate]) map[item.scheduledDate] = [];
      map[item.scheduledDate].push(item);
    });
    return map;
  }, [items]);

  const dayNames = isRTL
    ? ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(7, 1fr)` }}>
      {days.map((day, i) => {
        const dateStr = isoDate(day);
        const dayItems = itemsByDate[dateStr] ?? [];
        const isToday = dateStr === today;

        return (
          <div
            key={dateStr}
            className="flex flex-col gap-1 rounded-xl p-2 min-h-[160px] transition-all"
            style={{
              background: dragOver === dateStr ? "var(--surface-3)" : "var(--surface-1)",
              border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}`,
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(dateStr); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("contentItemId");
              setDragOver(null);
              if (id) onDrop(id, dateStr);
            }}
          >
            <div className="flex flex-col items-center gap-0.5 mb-1">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{dayNames[i]}</span>
              <span
                className="text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full"
                style={{
                  color: isToday ? "white" : "var(--text-primary)",
                  background: isToday ? "var(--accent)" : "transparent",
                }}
              >
                {day.getDate()}
              </span>
            </div>
            {dayItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("contentItemId", item.id); e.dataTransfer.effectAllowed = "move"; }}
                onClick={() => onItemClick(item)}
                className="rounded-lg px-1.5 py-1 text-[10px] font-medium cursor-pointer truncate"
                style={{
                  background: PLATFORM_COLORS[item.platform] + "22",
                  color: PLATFORM_COLORS[item.platform],
                  border: `1px solid ${PLATFORM_COLORS[item.platform]}44`,
                }}
              >
                {item.title}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Day view ──────────────────────────────────────────────────

function DayView({
  currentDate,
  items,
  onItemClick,
}: {
  currentDate: Date;
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
}) {
  const { t } = useLanguage();
  const dateStr = isoDate(currentDate);
  const dayItems = items.filter((i) => i.scheduledDate === dateStr);

  return (
    <div className="space-y-2">
      {dayItems.length === 0 ? (
        <div className="text-center py-12" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
          {t("content.noScheduledDate")}
        </div>
      ) : (
        dayItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
            style={{
              background: "var(--surface-2)",
              border: `1px solid var(--border)`,
              borderLeft: `3px solid ${STATUS_COLORS[item.status]}`,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-3)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: PLATFORM_COLORS[item.platform] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {item.platform} · {item.scheduledTime || "—"}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────

export function ContentCalendar({ items, onItemClick }: ContentCalendarProps) {
  const { updateContentItem } = useContentItems();
  const { t } = useLanguage();
  const [view, setView] = useState<CalendarView>("month");
  const [current, setCurrent] = useState(new Date());

  const navigate = (dir: -1 | 1) => {
    const next = new Date(current);
    if (view === "month") next.setMonth(next.getMonth() + dir);
    else if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setDate(next.getDate() + dir);
    setCurrent(next);
  };

  const handleDrop = async (itemId: string, newDate: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || item.scheduledDate === newDate) return;
    await updateContentItem(itemId, { scheduledDate: newDate });
  };

  const headerLabel = useMemo(() => {
    if (view === "month") {
      return current.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    if (view === "week") {
      const mon = startOfWeek(current);
      const sun = addDays(mon, 6);
      return `${mon.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${sun.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return current.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }, [current, view]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)44" }}
          >
            {t("content.today")}
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <ChevronRight size={15} />
          </button>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {headerLabel}
          </span>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: view === v ? "var(--surface-1)" : "transparent",
                color: view === v ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {t(`content.${v}View` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      {view === "month" && (
        <MonthView
          currentDate={current}
          items={items}
          onItemClick={onItemClick}
          onDateClick={(date) => { setCurrent(date); setView("day"); }}
          onDrop={handleDrop}
        />
      )}
      {view === "week" && (
        <WeekView
          currentDate={current}
          items={items}
          onItemClick={onItemClick}
          onDrop={handleDrop}
        />
      )}
      {view === "day" && (
        <DayView
          currentDate={current}
          items={items}
          onItemClick={onItemClick}
        />
      )}
    </div>
  );
}

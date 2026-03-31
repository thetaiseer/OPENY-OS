"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { PLATFORM_COLORS, STATUS_COLORS, PLATFORM_EMOJIS, isOverdue } from "./contentUtils";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";








// ── Helpers ────────────────────────────────────────────────────

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day + 6) % 7);
  r.setHours(0, 0, 0, 0);
  return r;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// ── Content chip ───────────────────────────────────────────────

function EventChip({ item, onClick }) {
  const overdue = isOverdue(item.scheduledDate) && item.status !== "published";
  const platformColor = PLATFORM_COLORS[item.platform];

  return (
    <button
      onClick={(e) => {e.stopPropagation();onClick();}}
      className="group w-full text-left px-1.5 py-0.5 rounded-md truncate transition-all"
      style={{
        background: overdue ? "var(--error)18" : platformColor + "18",
        color: overdue ? "var(--error)" : platformColor,
        border: `1px solid ${overdue ? "var(--error)30" : platformColor + "30"}`,
        fontSize: "10px",
        fontWeight: 500
      }}
      onMouseEnter={(e) => {e.currentTarget.style.opacity = "0.8";}}
      onMouseLeave={(e) => {e.currentTarget.style.opacity = "1";}}
      title={item.title}>
      
      <span style={{ fontSize: "9px", marginRight: 3 }}>{PLATFORM_EMOJIS[item.platform]}</span>
      {item.title}
    </button>);

}

// ── Month view ─────────────────────────────────────────────────

function MonthView({
  currentDate,
  items,
  onItemClick,
  onDateClick,
  onDrop






}) {
  const { isRTL } = useLanguage();
  const [dragOver, setDragOver] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);

  const today = isoDate(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = startOfMonth(currentDate);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = daysInMonth(year, month);

  const dayHeaders = isRTL ?
  ["الإث", "الثل", "الأر", "الخم", "الجم", "السب", "الأح"] :
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const itemsByDate = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      if (!item.scheduledDate) return;
      if (!map[item.scheduledDate]) map[item.scheduledDate] = [];
      map[item.scheduledDate].push(item);
    });
    return map;
  }, [items]);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const isPast = (date) => date < new Date(new Date().toDateString());

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d) =>
        <div
          key={d}
          className="text-center py-2 text-[11px] font-semibold"
          style={{ color: "var(--text-muted)" }}>
          
            {d}
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        className="grid grid-cols-7 rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)", gap: "1px", background: "var(--border)" }}>
        
        {cells.map((date, idx) => {
          const dateStr = date ? isoDate(date) : "";
          const dayItems = dateStr ? itemsByDate[dateStr] ?? [] : [];
          const isToday = dateStr === today;
          const isCurrentMonth = date ? date.getMonth() === month : false;
          const past = date ? isPast(date) : false;
          const isDragTarget = dragOver === dateStr;
          const isHovered = hoveredDay === dateStr && !!date;

          return (
            <div
              key={idx}
              className="flex flex-col gap-0.5 p-1.5 transition-all"
              style={{
                minHeight: "96px",
                background: isDragTarget ?
                "var(--accent-dim)" :
                isToday ?
                "var(--surface-2)" :
                "var(--surface-1)",
                cursor: date ? "pointer" : "default",
                opacity: !isCurrentMonth ? 0.35 : past && !isToday ? 0.65 : 1,
                position: "relative"
              }}
              onClick={() => date && onDateClick(date)}
              onMouseEnter={() => date && setHoveredDay(dateStr)}
              onMouseLeave={() => setHoveredDay(null)}
              onDragOver={(e) => {if (date) {e.preventDefault();setDragOver(dateStr);}}}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("contentItemId");
                setDragOver(null);
                if (id && dateStr) onDrop(id, dateStr);
              }}>
              
              {/* Day number */}
              <div className="flex items-start justify-between mb-0.5">
                <span
                  className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                  style={{
                    color: isToday ? "white" : "var(--text-primary)",
                    background: isToday ? "var(--accent)" : "transparent",
                    fontSize: "11px"
                  }}>
                  
                  {date?.getDate()}
                </span>
                {/* Add button on hover for empty or any day */}
                {isHovered && dayItems.length === 0 &&
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--accent)20" }}>
                  
                    <Plus size={10} style={{ color: "var(--accent)" }} />
                  </motion.div>
                }
              </div>

              {/* Event chips */}
              <div className="flex flex-col gap-0.5">
                {dayItems.slice(0, 3).map((item) =>
                <EventChip key={item.id} item={item} onClick={() => onItemClick(item)} />
                )}
                {dayItems.length > 3 &&
                <span
                  className="text-[9px] px-1 font-medium"
                  style={{ color: "var(--accent)" }}>
                  
                    +{dayItems.length - 3} more
                  </span>
                }
              </div>
            </div>);

        })}
      </div>
    </div>);

}

// ── Week view ──────────────────────────────────────────────────

function WeekView({
  currentDate,
  items,
  onItemClick,
  onDrop





}) {
  const [dragOver, setDragOver] = useState(null);
  const { isRTL } = useLanguage();
  const today = isoDate(new Date());
  const monday = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const itemsByDate = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      if (!item.scheduledDate) return;
      if (!map[item.scheduledDate]) map[item.scheduledDate] = [];
      map[item.scheduledDate].push(item);
    });
    return map;
  }, [items]);

  const dayNames = isRTL ?
  ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"] :
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
      {days.map((day, i) => {
        const dateStr = isoDate(day);
        const dayItems = itemsByDate[dateStr] ?? [];
        const isToday = dateStr === today;

        return (
          <div
            key={dateStr}
            className="flex flex-col gap-1.5 rounded-xl p-2.5 transition-all"
            style={{
              minHeight: "160px",
              background: dragOver === dateStr ? "var(--accent-dim)" : "var(--surface-1)",
              border: `1px solid ${isToday ? "var(--accent)60" : "var(--border)"}`,
              boxShadow: isToday ? "0 0 0 1px var(--accent)30" : "none"
            }}
            onDragOver={(e) => {e.preventDefault();setDragOver(dateStr);}}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("contentItemId");
              setDragOver(null);
              if (id) onDrop(id, dateStr);
            }}>
            
            <div className="flex flex-col items-center gap-0.5 mb-1">
              <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                {dayNames[i]}
              </span>
              <span
                className="text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full"
                style={{
                  color: isToday ? "white" : "var(--text-primary)",
                  background: isToday ? "var(--accent)" : "transparent"
                }}>
                
                {day.getDate()}
              </span>
            </div>

            {dayItems.map((item) =>
            <div
              key={item.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("contentItemId", item.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onItemClick(item)}
              className="rounded-lg px-1.5 py-1 cursor-pointer truncate transition-all"
              style={{
                background: PLATFORM_COLORS[item.platform] + "18",
                color: PLATFORM_COLORS[item.platform],
                border: `1px solid ${PLATFORM_COLORS[item.platform]}30`,
                fontSize: "10px",
                fontWeight: 500
              }}
              onMouseEnter={(e) => {e.currentTarget.style.opacity = "0.8";}}
              onMouseLeave={(e) => {e.currentTarget.style.opacity = "1";}}>
              
                <span style={{ fontSize: "9px", marginRight: 3 }}>{PLATFORM_EMOJIS[item.platform]}</span>
                {item.title}
              </div>
            )}

            {dayItems.length === 0 &&
            <div
              className="flex-1 flex items-center justify-center rounded-lg"
              style={{
                border: "1.5px dashed var(--border)",
                minHeight: "48px",
                color: "var(--text-muted)",
                fontSize: "10px"
              }}>
              
                <Plus size={12} style={{ opacity: 0.4 }} />
              </div>
            }
          </div>);

      })}
    </div>);

}

// ── Day view ───────────────────────────────────────────────────

function DayView({
  currentDate,
  items,
  onItemClick




}) {
  const { t } = useLanguage();
  const dateStr = isoDate(currentDate);
  const dayItems = items.filter((i) => i.scheduledDate === dateStr);

  return (
    <div className="space-y-2">
      {dayItems.length === 0 ?
      <div
        className="flex flex-col items-center justify-center gap-3 py-16"
        style={{ color: "var(--text-muted)" }}>
        
          <CalendarDays size={32} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: "13px" }}>{t("content.noScheduledDate")}</p>
        </div> :

      dayItems.map((item) =>
      <motion.div
        key={item.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => onItemClick(item)}
        className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
        style={{
          background: "var(--surface-2)",
          border: `1px solid var(--border)`,
          borderLeft: `3px solid ${STATUS_COLORS[item.status]}`
        }}
        whileHover={{ background: "var(--surface-3)" }}>
        
            <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: PLATFORM_COLORS[item.platform] }} />
        
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {item.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {item.platform} · {item.scheduledTime || "—"}
              </p>
            </div>
            <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: PLATFORM_COLORS[item.platform] + "18",
            color: PLATFORM_COLORS[item.platform]
          }}>
          
              {PLATFORM_EMOJIS[item.platform]}
            </span>
          </motion.div>
      )
      }
    </div>);

}

// ── Main Calendar ──────────────────────────────────────────────

export function ContentCalendar({ items, onItemClick }) {
  const { updateContentItem } = useContentItems();
  const { t } = useLanguage();
  const [view, setView] = useState("month");
  const [current, setCurrent] = useState(new Date());

  const navigate = (dir) => {
    const next = new Date(current);
    if (view === "month") next.setMonth(next.getMonth() + dir);else
    if (view === "week") next.setDate(next.getDate() + dir * 7);else
    next.setDate(next.getDate() + dir);
    setCurrent(next);
  };

  const handleDrop = async (itemId, newDate) => {
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {e.currentTarget.style.background = "var(--surface-3)";}}
            onMouseLeave={(e) => {e.currentTarget.style.background = "var(--surface-2)";}}>
            
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)44" }}
            onMouseEnter={(e) => {e.currentTarget.style.opacity = "0.8";}}
            onMouseLeave={(e) => {e.currentTarget.style.opacity = "1";}}>
            
            {t("content.today")}
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {e.currentTarget.style.background = "var(--surface-3)";}}
            onMouseLeave={(e) => {e.currentTarget.style.background = "var(--surface-2)";}}>
            
            <ChevronRight size={15} />
          </button>
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {headerLabel}
          </h2>
        </div>

        {/* View switcher */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
          {["month", "week", "day"].map((v) =>
          <button
            key={v}
            onClick={() => setView(v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize"
            style={{
              background: view === v ? "var(--surface-1)" : "transparent",
              color: view === v ? "var(--text-primary)" : "var(--text-muted)",
              boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
            }}>
            
              {t(`content.${v}View`)}
            </button>
          )}
        </div>
      </div>

      {/* Calendar body with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${view}-${current.toISOString().slice(0, 7)}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}>
          
          {view === "month" &&
          <MonthView
            currentDate={current}
            items={items}
            onItemClick={onItemClick}
            onDateClick={(date) => {setCurrent(date);setView("day");}}
            onDrop={handleDrop} />

          }
          {view === "week" &&
          <WeekView
            currentDate={current}
            items={items}
            onItemClick={onItemClick}
            onDrop={handleDrop} />

          }
          {view === "day" &&
          <DayView
            currentDate={current}
            items={items}
            onItemClick={onItemClick} />

          }
        </motion.div>
      </AnimatePresence>
    </div>);

}
"use client";

// ============================================================
// OPENY OS – Recurring Task Template Context
// Manages templates + monthly auto-generation of tasks
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect } from

"react";

import {
  subscribeToRecurringTaskTemplates,
  createRecurringTaskTemplate as fsCreate,
  updateRecurringTaskTemplate as fsUpdate,
  deleteRecurringTaskTemplate as fsDelete } from
"./supabase/recurringTasks";
import { createTask as fsCreateTask } from "./supabase/tasks";
import { withTimeout } from "./utils/crud";

// ── Helpers ──────────────────────────────────────────────────

/** Returns "YYYY-MM" for the current month. */
function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the ISO week string "YYYY-Www" for a given date.
 * Used to detect whether a weekly template was already generated this week.
 */
function isoWeekKey(date = new Date()) {
  // Copy date to avoid mutation
  const d = new Date(date);
  // Set to Thursday in current week (ISO week date standard)
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Returns a due date set to the last day of the current month. */
function endOfCurrentMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

/** Returns the date of the next Sunday (end of current ISO week). */
function endOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  return sunday.toISOString().slice(0, 10);
}

// ── Context shape ────────────────────────────────────────────






















const RecurringTaskContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────

export function RecurringTaskProvider({ children }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToRecurringTaskTemplates(
      (rows) => {setTemplates(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const createTemplate = useCallback(async (data) => {
    const now = new Date().toISOString();
    return withTimeout(fsCreate({
      title: data.title,
      clientId: data.clientId ?? "",
      assigneeId: data.assigneeId ?? "",
      assigneeName: data.assigneeName ?? "",
      priority: data.priority,
      frequency: data.frequency,
      workflowSteps: data.workflowSteps ?? [],
      isActive: true,
      lastGeneratedAt: null,
      createdAt: now,
      updatedAt: now
    }));
  }, []);

  const toggleTemplate = useCallback(async (id, isActive) => {
    await withTimeout(fsUpdate(id, { isActive, updatedAt: new Date().toISOString() }));
  }, []);

  const deleteTemplate = useCallback(async (id) => {
    await withTimeout(fsDelete(id));
  }, []);

  const runMonthlyGeneration = useCallback(async () => {
    const month = currentYearMonth();
    const week = isoWeekKey();
    let generated = 0;

    const active = templates.filter((t) => {
      if (!t.isActive) return false;
      if (t.frequency === "monthly") {
        // Only generate once per calendar month
        if (t.lastGeneratedAt && t.lastGeneratedAt.startsWith(month)) return false;
      } else if (t.frequency === "weekly") {
        // Only generate once per ISO week
        if (t.lastGeneratedAt && isoWeekKey(new Date(t.lastGeneratedAt)) === week) return false;
      }
      return true;
    });

    for (const tmpl of active) {
      const steps = tmpl.workflowSteps ?? [];
      const firstStep = steps[0];
      const assigneeId = firstStep?.assigneeId ?? tmpl.assigneeId ?? "";
      const assigneeName = firstStep?.assigneeName ?? tmpl.assigneeName ?? "Unassigned";
      const due = tmpl.frequency === "weekly" ? endOfCurrentWeek() : endOfCurrentMonth();

      await withTimeout(fsCreateTask({
        title: tmpl.title,
        clientId: tmpl.clientId ?? "",
        assignedTo: assigneeId,
        assigneeId,
        assignee: assigneeName,
        assigneeName,
        status: "todo",
        priority: tmpl.priority,
        dueDate: due,
        createdAt: new Date().toISOString(),
        completedAt: null,
        workflowSteps: steps.length > 0 ? steps : undefined,
        workflowIndex: steps.length > 0 ? 0 : undefined,
        recurringTemplateId: tmpl.id
      }));

      await withTimeout(fsUpdate(tmpl.id, { lastGeneratedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      generated++;
    }

    return { generated };
  }, [templates]);

  const value = useMemo(
    () => ({ templates, loading, createTemplate, toggleTemplate, deleteTemplate, runMonthlyGeneration }),
    [templates, loading, createTemplate, toggleTemplate, deleteTemplate, runMonthlyGeneration]
  );

  return <RecurringTaskContext.Provider value={value}>{children}</RecurringTaskContext.Provider>;
}

// ── Consumer hook ─────────────────────────────────────────────

export function useRecurringTasks() {
  const ctx = useContext(RecurringTaskContext);
  if (!ctx) throw new Error("useRecurringTasks must be used inside <RecurringTaskProvider>");
  return ctx;
}
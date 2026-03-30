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
  useEffect,
  type ReactNode,
} from "react";
import type { RecurringTaskTemplate, WorkflowStep } from "./types";
import {
  subscribeToRecurringTaskTemplates,
  createRecurringTaskTemplate as fsCreate,
  updateRecurringTaskTemplate as fsUpdate,
  deleteRecurringTaskTemplate as fsDelete,
} from "./firestore/recurringTasks";
import { createTask as fsCreateTask } from "./firestore/tasks";
import { withTimeout } from "./utils/crud";

// ── Helpers ──────────────────────────────────────────────────

/** Returns "YYYY-MM" for the current month. */
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns a due date set to the last day of the current month. */
function endOfCurrentMonth(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

// ── Context shape ────────────────────────────────────────────

export type CreateTemplateData = {
  title: string;
  clientId?: string;
  assigneeId?: string;
  assigneeName?: string;
  priority: RecurringTaskTemplate["priority"];
  frequency: RecurringTaskTemplate["frequency"];
  workflowSteps?: WorkflowStep[];
};

interface RecurringTaskContextValue {
  templates: RecurringTaskTemplate[];
  loading: boolean;
  createTemplate: (data: CreateTemplateData) => Promise<string>;
  toggleTemplate: (id: string, isActive: boolean) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  /** Spawns tasks from all active templates that have not yet been generated
   *  this month.  Safe to call multiple times – idempotent per month. */
  runMonthlyGeneration: () => Promise<{ generated: number }>;
}

const RecurringTaskContext = createContext<RecurringTaskContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function RecurringTaskProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<RecurringTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToRecurringTaskTemplates(
      (rows) => { setTemplates(rows); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const createTemplate = useCallback(async (data: CreateTemplateData): Promise<string> => {
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
      updatedAt: now,
    }));
  }, []);

  const toggleTemplate = useCallback(async (id: string, isActive: boolean): Promise<void> => {
    await withTimeout(fsUpdate(id, { isActive, updatedAt: new Date().toISOString() }));
  }, []);

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    await withTimeout(fsDelete(id));
  }, []);

  const runMonthlyGeneration = useCallback(async (): Promise<{ generated: number }> => {
    const month = currentYearMonth();
    const due = endOfCurrentMonth();
    let generated = 0;

    const active = templates.filter((t) => {
      if (!t.isActive) return false;
      if (t.frequency === "monthly") {
        // Only generate once per month
        if (t.lastGeneratedAt && t.lastGeneratedAt.startsWith(month)) return false;
      }
      return true;
    });

    for (const tmpl of active) {
      const steps = tmpl.workflowSteps ?? [];
      const firstStep: WorkflowStep | undefined = steps[0];
      const assigneeId = firstStep?.assigneeId ?? tmpl.assigneeId ?? "";
      const assigneeName = firstStep?.assigneeName ?? tmpl.assigneeName ?? "Unassigned";

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
        recurringTemplateId: tmpl.id,
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

export function useRecurringTasks(): RecurringTaskContextValue {
  const ctx = useContext(RecurringTaskContext);
  if (!ctx) throw new Error("useRecurringTasks must be used inside <RecurringTaskProvider>");
  return ctx;
}

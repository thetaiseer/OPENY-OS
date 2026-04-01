"use client";

// ============================================================
// OPENY OS – Centralised Application Store (Firestore Edition)
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect } from

"react";

import {
  subscribeToClients,
  createClient as fsCreateClient,
  updateClient as fsUpdateClient,
  deleteClient as fsDeleteClient } from
"./supabase/clients";
import {
  subscribeToTasks,
  createTask as fsCreateTask,
  updateTask as fsUpdateTask,
  deleteTask as fsDeleteTask } from
"./supabase/tasks";
import {
  subscribeToTeam,
  createTeamMember as fsCreateTeamMember,
  deleteTeamMember as fsDeleteTeamMember } from
"./supabase/team";
import {
  subscribeToActivities,
  createActivity as fsCreateActivity,
  clearAllActivities as fsClearAllActivities } from
"./supabase/activities";
import { pushNotification as fsPushNotification } from "./supabase/notifications";
import { withTimeout, fireAndForget } from "./utils/crud";

// ── Notification helper (writes to Firestore via service layer) ─

async function pushNotificationDoc(
type,
title,
message,
entityId)
{
  try {
    await fsPushNotification(type, title, message, entityId);
  } catch (err) {
    console.error("[OPENY] Failed to create notification:", err);
  }
}

// ── Helpers ──────────────────────────────────────────────────

const PALETTE = ["#4f8ef7", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#8888a0"];

function pickColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function makeInitials(name) {
  return name.
  split(" ").
  map((w) => w[0]).
  join("").
  slice(0, 2).
  toUpperCase();
}

// ── Context shape ────────────────────────────────────────────




































const AppContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Firestore real-time listeners (via service layer) ─────
  useEffect(() => {
    const loadedSet = new Set();
    const markLoaded = (name) => {
      loadedSet.add(name);
      if (loadedSet.size === 4) setLoading(false);
    };

    // Safety valve: if any subscription never fires (e.g. network issues
    // on first load), force loading=false after 6 s so the UI is never
    // stuck on a spinner indefinitely.
    const safetyTimer = setTimeout(() => setLoading(false), 6000);

    const unsubClients = subscribeToClients(
      (rows) => {setClients(rows);markLoaded("clients");},
      () => markLoaded("clients")
    );

    const unsubTasks = subscribeToTasks(
      (rows) => {setTasks(rows);markLoaded("tasks");},
      () => markLoaded("tasks")
    );

    const unsubMembers = subscribeToTeam(
      (rows) => {setMembers(rows);markLoaded("team");},
      () => markLoaded("team")
    );

    const unsubActivities = subscribeToActivities(
      (rows) => {setActivities(rows);markLoaded("activities");},
      () => markLoaded("activities")
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubClients();
      unsubTasks();
      unsubMembers();
      unsubActivities();
    };
  }, []);

  // ── Internal activity logger (via service layer) ──────────
  const pushActivity = useCallback(
    async (type, message, detail, entityId) => {
      await fsCreateActivity(type, message, detail, entityId);
    },
    []
  );

  // ── Client actions (via service layer) ───────────────────
  const addClient = useCallback(
    async (data) => {
      const id = await withTimeout(fsCreateClient({
        name: data.name,
        company: data.name,
        email: data.email,
        phone: data.phone ?? null,
        website: data.website ?? null,
        status: "prospect",
        createdAt: new Date().toISOString(),
        initials: makeInitials(data.name),
        color: pickColor()
      }));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("client_added", "New client added", data.name, id));
      fireAndForget(pushNotificationDoc("client_created", "New Client Added", data.name, id));
    },
    [pushActivity]
  );

  const updateClient = useCallback(
    async (id, data) => {
      await withTimeout(fsUpdateClient(id, data));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("client_updated", "Client updated", data.name ?? id, id));
      fireAndForget(pushNotificationDoc("client_updated", "Client Updated", data.name ?? id, id));
    },
    [pushActivity]
  );

  const deleteClient = useCallback(
    async (id) => {
      const client = clients.find((c) => c.id === id);
      if (process.env.NODE_ENV !== "production") console.log("[OPENY:deleteClient] start", id);
      try {
        // Cascade: unlink tasks that reference this client (non-blocking)
        const relatedTasks = tasks.filter((t) => t.clientId === id);
        if (relatedTasks.length > 0) {
          if (process.env.NODE_ENV !== "production") console.log("[OPENY:deleteClient] unlinking", relatedTasks.length, "task(s)");
          fireAndForget(Promise.all(relatedTasks.map((t) => fsUpdateTask(t.id, { clientId: "" }))));
        }
        await withTimeout(fsDeleteClient(id));
        if (process.env.NODE_ENV !== "production") console.log("[OPENY:deleteClient] Firestore delete success", id);
        // Secondary side-effect: do not block the UI
        fireAndForget(pushActivity("client_deleted", "Client removed", client?.name ?? id, id));
        if (process.env.NODE_ENV !== "production") console.log("[OPENY:deleteClient] done", id);
      } catch (err) {
        console.error("[OPENY:deleteClient] error", id, err);
        throw err;
      }
    },
    [clients, tasks, pushActivity]
  );

  // ── Task actions (via service layer) ─────────────────────
  const addTask = useCallback(
    async (data) =>







    {
      // assigneeName is the snapshot; assignee is kept for backward compat
      const displayName = data.assigneeName || data.assignee || "Unassigned";
      const id = await withTimeout(fsCreateTask({
        title: data.title,
        clientId: data.clientId ?? "",
        // assignedTo kept for backward compatibility with older documents that used this field name
        assignedTo: data.assigneeId ?? "",
        assigneeId: data.assigneeId ?? "",
        // assignee kept as a plain-text fallback for older display code; assigneeName is the canonical snapshot
        assignee: displayName,
        assigneeName: displayName,
        status: "todo",
        priority: data.priority,
        dueDate: data.dueDate || "TBD",
        createdAt: new Date().toISOString(),
        completedAt: null
      }));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("task_created", "New task created", data.title, id));
      fireAndForget(pushNotificationDoc("task_created", "New Task Created", data.title, id));
    },
    [pushActivity]
  );

  const updateTask = useCallback(
    async (id, data) => {
      await withTimeout(fsUpdateTask(id, data));
    },
    []
  );

  const deleteTask = useCallback(
    async (id) => {
      await withTimeout(fsDeleteTask(id));
    },
    []
  );

  // Keep a stable ref to the latest tasks list so toggleTaskDone
  // can read the current value without re-creating its identity on every render.
  const tasksRef = useRef(tasks);
  useEffect(() => {tasksRef.current = tasks;}, [tasks]);

  const toggleTaskDone = useCallback(
    async (id) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      const isDone = task.status === "done";
      await withTimeout(fsUpdateTask(id, {
        status: isDone ? "todo" : "done",
        completedAt: isDone ? null : new Date().toISOString()
      }));
      if (!isDone) {
        // Secondary side-effects: do not block the UI
        fireAndForget(pushActivity("task_completed", "Task completed", task.title, id));
        fireAndForget(pushNotificationDoc("task_completed", "Task Completed", task.title, id));

        // ── Workflow auto-routing ────────────────────────────
        // If this task has workflow steps and is not on the last step,
        // create a new task for the next step automatically.
        const steps = task.workflowSteps;
        const currentIndex = task.workflowIndex ?? 0;
        if (steps && steps.length > 0 && currentIndex < steps.length - 1) {
          const nextIndex = currentIndex + 1;
          const nextStep = steps[nextIndex];
          fireAndForget(
            fsCreateTask({
              title: task.title,
              clientId: task.clientId ?? "",
              assignedTo: nextStep.assigneeId,
              assigneeId: nextStep.assigneeId,
              assignee: nextStep.assigneeName,
              assigneeName: nextStep.assigneeName,
              status: "todo",
              priority: task.priority,
              dueDate: task.dueDate,
              createdAt: new Date().toISOString(),
              completedAt: null,
              workflowSteps: steps,
              workflowIndex: nextIndex,
              recurringTemplateId: task.recurringTemplateId
            }).then((newId) => {
              pushActivity(
                "task_created",
                `Workflow advanced to "${nextStep.label}"`,
                task.title,
                newId
              );
              pushNotificationDoc(
                "task_assigned",
                "Task Assigned",
                `"${task.title}" is ready for ${nextStep.assigneeName}`,
                newId
              );
            })
          );
        }
      }
    },
    [pushActivity]
  );

  // ── Member actions (via service layer) ───────────────────
  const addMember = useCallback(
    async (data) => {
      const id = await withTimeout(fsCreateTeamMember({
        name: data.name,
        role: data.role,
        email: data.email,
        status: "active",
        initials: makeInitials(data.name),
        color: pickColor(),
        createdAt: new Date().toISOString()
      }));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("member_joined", "Team member joined", `${data.name} — ${data.role}`, id));
      fireAndForget(pushNotificationDoc("member_added", "Team Member Added", `${data.name} joined as ${data.role}`, id));
    },
    [pushActivity]
  );

  const deleteMember = useCallback(
    async (id) => {
      const member = members.find((m) => m.id === id);
      // Cascade: unlink tasks assigned to this member (non-blocking)
      const relatedTasks = tasks.filter((t) => t.assigneeId === id);
      fireAndForget(Promise.all(
        relatedTasks.map((t) =>
        fsUpdateTask(t.id, { assigneeId: "", assignee: "Unassigned", assigneeName: "Unassigned" })
        )
      ));
      await withTimeout(fsDeleteTeamMember(id));
      // Secondary side-effect: do not block the UI
      fireAndForget(pushActivity("member_removed", "Team member removed", member?.name ?? id, id));
    },
    [members, tasks, pushActivity]
  );

  const clearActivities = useCallback(async () => {
    await withTimeout(fsClearAllActivities());
  }, []);

  // ── Computed values ───────────────────────────────────────
  const totalClientCount = useMemo(() => clients.length, [clients]);
  const openTaskCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks]
  );
  const teamMemberCount = useMemo(() => members.length, [members]);

  const value = useMemo(
    () => ({
      clients,
      tasks,
      members,
      activities,
      systemStatuses: [],
      loading,
      totalClientCount,
      openTaskCount,
      teamMemberCount,
      addClient,
      updateClient,
      deleteClient,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskDone,
      addMember,
      deleteMember,
      clearActivities
    }),
    [
    clients,
    tasks,
    members,
    activities,
    loading,
    totalClientCount,
    openTaskCount,
    teamMemberCount,
    addClient,
    updateClient,
    deleteClient,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskDone,
    addMember,
    deleteMember,
    clearActivities]

  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ── Consumer hooks ────────────────────────────────────────────

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used inside <AppProvider>");
  return ctx;
}

export function useClients() {
  const { clients, addClient, updateClient, deleteClient, totalClientCount } = useAppStore();
  return { clients, addClient, updateClient, deleteClient, totalClientCount };
}

export function useTasks() {
  const { tasks, addTask, updateTask, deleteTask, toggleTaskDone, openTaskCount } = useAppStore();
  return { tasks, addTask, updateTask, deleteTask, toggleTaskDone, openTaskCount };
}

export function useTeam() {
  const { members, addMember, deleteMember, teamMemberCount } = useAppStore();
  return { members, addMember, deleteMember, teamMemberCount };
}

export function useActivities() {
  const { activities, clearActivities } = useAppStore();
  return { activities, clearActivities };
}
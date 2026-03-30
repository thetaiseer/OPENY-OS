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
  useEffect,
  type ReactNode,
} from "react";
import type { Activity, ActivityType, Client, SystemStatus, Task, TeamMember } from "./types";
import {
  subscribeToClients,
  createClient as fsCreateClient,
  updateClient as fsUpdateClient,
  deleteClient as fsDeleteClient,
} from "./firestore/clients";
import {
  subscribeToTasks,
  createTask as fsCreateTask,
  updateTask as fsUpdateTask,
  deleteTask as fsDeleteTask,
} from "./firestore/tasks";
import {
  subscribeToTeam,
  createTeamMember as fsCreateTeamMember,
  deleteTeamMember as fsDeleteTeamMember,
} from "./firestore/team";
import {
  subscribeToActivities,
  createActivity as fsCreateActivity,
} from "./firestore/activities";
import { pushNotification as fsPushNotification } from "./firestore/notifications";

// ── Notification helper (writes to Firestore via service layer) ─

async function pushNotificationDoc(
  type: string,
  title: string,
  message: string,
  entityId: string
) {
  try {
    await fsPushNotification(type as Parameters<typeof fsPushNotification>[0], title, message, entityId);
  } catch (err) {
    console.error("[OPENY] Failed to create notification:", err);
  }
}

// ── Timeout + fire-and-forget helpers ────────────────────────

/**
 * Races a promise against a timeout so that a slow/offline Firestore
 * write never leaves the UI frozen indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Operation timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Runs a secondary side-effect (activity log, notification) without
 * blocking the calling operation. Errors are swallowed to avoid
 * unhandled-rejection warnings.
 */
function fireAndForget(promise: Promise<unknown>): void {
  promise.catch((err) => console.error("[OPENY] Side-effect error:", err));
}

// ── Helpers ──────────────────────────────────────────────────

const PALETTE = ["#4f8ef7", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#8888a0"];

function pickColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function makeInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Context shape ────────────────────────────────────────────

interface AppContextValue {
  // Data
  clients: Client[];
  tasks: Task[];
  members: TeamMember[];
  activities: Activity[];
  systemStatuses: SystemStatus[];

  // Loading
  loading: boolean;

  // Computed
  totalClientCount: number;
  openTaskCount: number;
  teamMemberCount: number;

  // Client actions
  addClient: (data: { name: string; email: string; website?: string; phone?: string }) => Promise<void>;
  updateClient: (id: string, data: Partial<Omit<Client, "id">>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  // Task actions
  addTask: (data: { title: string; clientId?: string; assigneeId?: string; assigneeName?: string; assignee?: string; priority: Task["priority"]; dueDate: string }) => Promise<void>;
  updateTask: (id: string, data: Partial<Omit<Task, "id">>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskDone: (id: string) => Promise<void>;

  // Member actions
  addMember: (data: { name: string; role: string; email: string }) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Firestore real-time listeners (via service layer) ─────
  useEffect(() => {
    const loadedSet = new Set<string>();
    const markLoaded = (name: string) => {
      loadedSet.add(name);
      if (loadedSet.size === 4) setLoading(false);
    };

    const unsubClients = subscribeToClients(
      (rows) => { setClients(rows); markLoaded("clients"); },
      () => markLoaded("clients"),
    );

    const unsubTasks = subscribeToTasks(
      (rows) => { setTasks(rows); markLoaded("tasks"); },
      () => markLoaded("tasks"),
    );

    const unsubMembers = subscribeToTeam(
      (rows) => { setMembers(rows); markLoaded("team"); },
      () => markLoaded("team"),
    );

    const unsubActivities = subscribeToActivities(
      (rows) => { setActivities(rows); markLoaded("activities"); },
      () => markLoaded("activities"),
    );

    return () => {
      unsubClients();
      unsubTasks();
      unsubMembers();
      unsubActivities();
    };
  }, []);

  // ── Internal activity logger (via service layer) ──────────
  const pushActivity = useCallback(
    async (type: ActivityType, message: string, detail: string, entityId: string) => {
      await fsCreateActivity(type, message, detail, entityId);
    },
    [],
  );

  // ── Client actions (via service layer) ───────────────────
  const addClient = useCallback(
    async (data: { name: string; email: string; website?: string; phone?: string }) => {
      const id = await withTimeout(fsCreateClient({
        name: data.name,
        company: data.name,
        email: data.email,
        phone: data.phone ?? null,
        website: data.website ?? null,
        status: "prospect",
        createdAt: new Date().toISOString(),
        initials: makeInitials(data.name),
        color: pickColor(),
      } as Omit<Client, "id">));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("client_added", "New client added", data.name, id));
      fireAndForget(pushNotificationDoc("client_created", "New Client Added", data.name, id));
    },
    [pushActivity],
  );

  const updateClient = useCallback(
    async (id: string, data: Partial<Omit<Client, "id">>) => {
      await withTimeout(fsUpdateClient(id, data));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("client_updated", "Client updated", data.name ?? id, id));
      fireAndForget(pushNotificationDoc("client_updated", "Client Updated", data.name ?? id, id));
    },
    [pushActivity],
  );

  const deleteClient = useCallback(
    async (id: string) => {
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
    [clients, tasks, pushActivity],
  );

  // ── Task actions (via service layer) ─────────────────────
  const addTask = useCallback(
    async (data: {
      title: string;
      clientId?: string;
      assigneeId?: string;
      assigneeName?: string;
      assignee?: string;
      priority: Task["priority"];
      dueDate: string;
    }) => {
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
        completedAt: null,
      } as Omit<Task, "id">));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("task_created", "New task created", data.title, id));
      fireAndForget(pushNotificationDoc("task_created", "New Task Created", data.title, id));
    },
    [pushActivity],
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Omit<Task, "id">>) => {
      await withTimeout(fsUpdateTask(id, data));
    },
    [],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await withTimeout(fsDeleteTask(id));
    },
    [],
  );

  // Keep a stable ref to the latest tasks list so toggleTaskDone
  // can read the current value without re-creating its identity on every render.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const toggleTaskDone = useCallback(
    async (id: string) => {
      const task = tasksRef.current.find((t) => t.id === id);
      if (!task) return;
      const isDone = task.status === "done";
      await withTimeout(fsUpdateTask(id, {
        status: isDone ? "todo" : "done",
        completedAt: isDone ? null : new Date().toISOString(),
      }));
      if (!isDone) {
        // Secondary side-effects: do not block the UI
        fireAndForget(pushActivity("task_completed", "Task completed", task.title, id));
        fireAndForget(pushNotificationDoc("task_completed", "Task Completed", task.title, id));
      }
    },
    [pushActivity],
  );

  // ── Member actions (via service layer) ───────────────────
  const addMember = useCallback(
    async (data: { name: string; role: string; email: string }) => {
      const id = await withTimeout(fsCreateTeamMember({
        name: data.name,
        role: data.role,
        email: data.email,
        status: "active",
        initials: makeInitials(data.name),
        color: pickColor(),
        createdAt: new Date().toISOString(),
      } as Omit<TeamMember, "id">));
      // Secondary side-effects: do not block the UI
      fireAndForget(pushActivity("member_joined", "Team member joined", `${data.name} — ${data.role}`, id));
      fireAndForget(pushNotificationDoc("member_added", "Team Member Added", `${data.name} joined as ${data.role}`, id));
    },
    [pushActivity],
  );

  const deleteMember = useCallback(
    async (id: string) => {
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
    [members, tasks, pushActivity],
  );

  // ── Computed values ───────────────────────────────────────
  const totalClientCount = useMemo(() => clients.length, [clients]);
  const openTaskCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks],
  );
  const teamMemberCount = useMemo(() => members.length, [members]);

  const value: AppContextValue = useMemo(
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ── Consumer hooks ────────────────────────────────────────────

export function useAppStore(): AppContextValue {
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
  const { activities } = useAppStore();
  return { activities };
}

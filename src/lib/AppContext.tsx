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
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Activity, ActivityType, Client, SystemStatus, Task, TeamMember } from "./types";

// ── Notification helper (writes to Firestore independently) ───

async function pushNotificationDoc(
  type: string,
  title: string,
  message: string,
  entityId: string
) {
  try {
    await addDoc(collection(db, "notifications"), {
      type,
      title,
      message,
      entityId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[OPENY] Failed to create notification:", err);
  }
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

  // ── Firestore real-time listeners ─────────────────────────
  useEffect(() => {
    const loadedSet = new Set<string>();
    const markLoaded = (name: string) => {
      loadedSet.add(name);
      if (loadedSet.size === 4) setLoading(false);
    };
    const handleError = (name: string, err: unknown) => {
      console.error(`[OPENY] Firestore listener error for "${name}":`, err);
      markLoaded(name);
    };

    const unsubClients = onSnapshot(
      query(collection(db, "clients"), orderBy("createdAt", "desc")),
      (snap) => {
        setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
        markLoaded("clients");
      },
      (err) => handleError("clients", err),
    );

    const unsubTasks = onSnapshot(
      query(collection(db, "tasks"), orderBy("createdAt", "desc")),
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
        markLoaded("tasks");
      },
      (err) => handleError("tasks", err),
    );

    const unsubMembers = onSnapshot(
      query(collection(db, "team"), orderBy("createdAt", "desc")),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamMember)));
        markLoaded("team");
      },
      (err) => handleError("team", err),
    );

    const unsubActivities = onSnapshot(
      query(collection(db, "activities"), orderBy("timestamp", "desc")),
      (snap) => {
        setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity)));
        markLoaded("activities");
      },
      (err) => handleError("activities", err),
    );

    return () => {
      unsubClients();
      unsubTasks();
      unsubMembers();
      unsubActivities();
    };
  }, []);

  // ── Internal activity logger ──────────────────────────────
  const pushActivity = useCallback(
    async (type: ActivityType, message: string, detail: string, entityId: string) => {
      await addDoc(collection(db, "activities"), {
        type,
        message,
        detail,
        entityId,
        timestamp: new Date().toISOString(),
      });
    },
    [],
  );

  // ── Client actions ────────────────────────────────────────
  const addClient = useCallback(
    async (data: { name: string; email: string; website?: string; phone?: string }) => {
      const docRef = await addDoc(collection(db, "clients"), {
        name: data.name,
        company: data.name,
        email: data.email,
        phone: data.phone ?? null,
        website: data.website ?? null,
        status: "prospect",
        createdAt: new Date().toISOString(),
        initials: makeInitials(data.name),
        color: pickColor(),

      });
      await pushActivity("client_added", "New client added", data.name, docRef.id);
      await pushNotificationDoc("client_created", "New Client Added", data.name, docRef.id);
    },
    [pushActivity],
  );

  const updateClient = useCallback(
    async (id: string, data: Partial<Omit<Client, "id">>) => {
      await updateDoc(doc(db, "clients", id), data);
      await pushActivity("client_updated", "Client updated", data.name ?? id, id);
      await pushNotificationDoc("client_updated", "Client Updated", data.name ?? id, id);
    },
    [pushActivity],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      const client = clients.find((c) => c.id === id);
      await deleteDoc(doc(db, "clients", id));
      await pushActivity("client_deleted", "Client removed", client?.name ?? id, id);
    },
    [clients, pushActivity],
  );

  // ── Task actions ──────────────────────────────────────────
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
      const docRef = await addDoc(collection(db, "tasks"), {
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
      });
      await pushActivity("task_created", "New task created", data.title, docRef.id);
      await pushNotificationDoc("task_created", "New Task Created", data.title, docRef.id);
    },
    [pushActivity],
  );

  const updateTask = useCallback(
    async (id: string, data: Partial<Omit<Task, "id">>) => {
      await updateDoc(doc(db, "tasks", id), data);
    },
    [],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, "tasks", id));
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
      await updateDoc(doc(db, "tasks", id), {
        status: isDone ? "todo" : "done",
        completedAt: isDone ? null : new Date().toISOString(),
      });
      if (!isDone) {
        await pushActivity("task_completed", "Task completed", task.title, id);
        await pushNotificationDoc("task_completed", "Task Completed", task.title, id);
      }
    },
    [pushActivity],
  );

  // ── Member actions ────────────────────────────────────────
  const addMember = useCallback(
    async (data: { name: string; role: string; email: string }) => {
      const docRef = await addDoc(collection(db, "team"), {
        name: data.name,
        role: data.role,
        email: data.email,
        status: "active",
        initials: makeInitials(data.name),
        color: pickColor(),

        createdAt: new Date().toISOString(),
      });
      await pushActivity("member_joined", "Team member joined", `${data.name} — ${data.role}`, docRef.id);
      await pushNotificationDoc("member_added", "Team Member Added", `${data.name} joined as ${data.role}`, docRef.id);
    },
    [pushActivity],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      const member = members.find((m) => m.id === id);
      await deleteDoc(doc(db, "team", id));
      await pushActivity("member_removed", "Team member removed", member?.name ?? id, id);
    },
    [members, pushActivity],
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

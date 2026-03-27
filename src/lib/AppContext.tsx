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
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Activity, ActivityType, Client, Project, SystemStatus, Task, TeamMember } from "./types";

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
  projects: Project[];
  tasks: Task[];
  members: TeamMember[];
  activities: Activity[];
  systemStatuses: SystemStatus[];

  // Loading
  loading: boolean;

  // Computed
  activeProjectCount: number;
  totalClientCount: number;
  openTaskCount: number;
  teamMemberCount: number;

  // Client actions
  addClient: (data: { name: string; email: string; website?: string; phone?: string }) => Promise<void>;

  // Project actions
  addProject: (data: { name: string; description: string; client: string; dueDate: string }) => Promise<void>;

  // Task actions
  addTask: (data: { title: string; project: string; assignee: string; priority: Task["priority"]; dueDate: string }) => Promise<void>;
  toggleTaskDone: (id: string) => Promise<void>;

  // Member actions
  addMember: (data: { name: string; role: string; email: string }) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Firestore real-time listeners ─────────────────────────
  useEffect(() => {
    // Track which collections have received their first snapshot (success or error).
    // On error the collection stays empty and loading is cleared so the app remains usable.
    const loadedSet = new Set<string>();
    const markLoaded = (name: string) => {
      loadedSet.add(name);
      if (loadedSet.size === 5) setLoading(false);
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

    const unsubProjects = onSnapshot(
      query(collection(db, "projects"), orderBy("createdAt", "desc")),
      (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
        markLoaded("projects");
      },
      (err) => handleError("projects", err),
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
      unsubProjects();
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
        projects: 0,
      });
      await pushActivity("client_added", "New client added", data.name, docRef.id);
    },
    [pushActivity],
  );

  // ── Project actions ───────────────────────────────────────
  const addProject = useCallback(
    async (data: { name: string; description: string; client: string; dueDate: string }) => {
      const docRef = await addDoc(collection(db, "projects"), {
        name: data.name,
        clientId: "",
        client: data.client || "—",
        description: data.description,
        status: "planning",
        progress: 0,
        team: 1,
        dueDate: data.dueDate || "TBD",
        color: pickColor(),
        createdAt: new Date().toISOString(),
      });
      await pushActivity("project_created", "New project created", data.name, docRef.id);
    },
    [pushActivity],
  );

  // ── Task actions ──────────────────────────────────────────
  const addTask = useCallback(
    async (data: {
      title: string;
      project: string;
      assignee: string;
      priority: Task["priority"];
      dueDate: string;
    }) => {
      const docRef = await addDoc(collection(db, "tasks"), {
        title: data.title,
        projectId: "",
        project: data.project || "—",
        assignedTo: "",
        assignee: data.assignee || "Unassigned",
        status: "todo",
        priority: data.priority,
        dueDate: data.dueDate || "TBD",
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
      await pushActivity("task_created", "New task created", data.title, docRef.id);
    },
    [pushActivity],
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
        projects: 0,
        createdAt: new Date().toISOString(),
      });
      await pushActivity("member_joined", "Team member joined", `${data.name} — ${data.role}`, docRef.id);
    },
    [pushActivity],
  );

  // ── Computed values ───────────────────────────────────────
  const activeProjectCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects],
  );
  const totalClientCount = useMemo(() => clients.length, [clients]);
  const openTaskCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks],
  );
  const teamMemberCount = useMemo(() => members.length, [members]);

  const value: AppContextValue = useMemo(
    () => ({
      clients,
      projects,
      tasks,
      members,
      activities,
      systemStatuses: [],
      loading,
      activeProjectCount,
      totalClientCount,
      openTaskCount,
      teamMemberCount,
      addClient,
      addProject,
      addTask,
      toggleTaskDone,
      addMember,
    }),
    [
      clients,
      projects,
      tasks,
      members,
      activities,
      loading,
      activeProjectCount,
      totalClientCount,
      openTaskCount,
      teamMemberCount,
      addClient,
      addProject,
      addTask,
      toggleTaskDone,
      addMember,
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
  const { clients, addClient, totalClientCount } = useAppStore();
  return { clients, addClient, totalClientCount };
}

export function useProjects() {
  const { projects, addProject, activeProjectCount } = useAppStore();
  return { projects, addProject, activeProjectCount };
}

export function useTasks() {
  const { tasks, addTask, toggleTaskDone, openTaskCount } = useAppStore();
  return { tasks, addTask, toggleTaskDone, openTaskCount };
}

export function useTeam() {
  const { members, addMember, teamMemberCount } = useAppStore();
  return { members, addMember, teamMemberCount };
}

export function useActivities() {
  const { activities } = useAppStore();
  return { activities };
}

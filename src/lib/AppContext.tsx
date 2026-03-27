"use client";

// ============================================================
// OPENY OS – Centralised Application Store
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
import type { Activity, ActivityType, Client, Project, SystemStatus, Task, TeamMember } from "./types";

// ── Helpers ──────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

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

  // Computed
  activeProjectCount: number;
  totalClientCount: number;
  openTaskCount: number;
  teamMemberCount: number;

  // Client actions
  addClient: (data: { name: string; email: string; website?: string; phone?: string }) => void;

  // Project actions
  addProject: (data: { name: string; description: string; client: string; dueDate: string }) => void;

  // Task actions
  addTask: (data: { title: string; project: string; assignee: string; priority: Task["priority"]; dueDate: string }) => void;
  toggleTaskDone: (id: string) => void;

  // Member actions
  addMember: (data: { name: string; role: string; email: string }) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ── LocalStorage persistence helpers ─────────────────────────

const LS_KEYS = {
  clients: "openy_clients",
  projects: "openy_projects",
  tasks: "openy_tasks",
  members: "openy_members",
  activities: "openy_activities",
};

// Bump this version whenever the data schema changes (e.g. demo data removed).
// On a version mismatch all stored data is wiped so the app starts clean.
const DATA_VERSION = "2";
const DATA_VERSION_KEY = "openy_data_version";

function migrateIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) {
    Object.values(LS_KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
  }
}

function loadFromLS<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function saveToLS(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded – silently ignore
  }
}

// ── Provider ─────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>(() => {
    migrateIfNeeded();
    return loadFromLS<Client>(LS_KEYS.clients, []);
  });
  const [projects, setProjects] = useState<Project[]>(() =>
    loadFromLS<Project>(LS_KEYS.projects, [])
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    loadFromLS<Task>(LS_KEYS.tasks, [])
  );
  const [members, setMembers] = useState<TeamMember[]>(() =>
    loadFromLS<TeamMember>(LS_KEYS.members, [])
  );
  const [activities, setActivities] = useState<Activity[]>(() =>
    loadFromLS<Activity>(LS_KEYS.activities, [])
  );

  // Persist on every state change
  useEffect(() => { saveToLS(LS_KEYS.clients, clients); }, [clients]);
  useEffect(() => { saveToLS(LS_KEYS.projects, projects); }, [projects]);
  useEffect(() => { saveToLS(LS_KEYS.tasks, tasks); }, [tasks]);
  useEffect(() => { saveToLS(LS_KEYS.members, members); }, [members]);
  useEffect(() => { saveToLS(LS_KEYS.activities, activities); }, [activities]);

  // ── Internal activity logger ──────────────────────────────
  const pushActivity = useCallback(
    (type: ActivityType, message: string, detail: string, entityId: string) => {
      setActivities((prev) => [
        {
          id: uid(),
          type,
          message,
          detail,
          entityId,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    []
  );

  // ── Client actions ────────────────────────────────────────
  const addClient = useCallback(
    (data: { name: string; email: string; website?: string; phone?: string }) => {
      const id = uid();
      const client: Client = {
        id,
        name: data.name,
        company: data.name,
        email: data.email,
        phone: data.phone,
        website: data.website,
        status: "prospect",
        createdAt: new Date().toISOString(),
        initials: makeInitials(data.name),
        color: pickColor(),
        projects: 0,
      };
      setClients((prev) => [...prev, client]);
      pushActivity("client_added", "New client added", data.name, id);
    },
    [pushActivity]
  );

  // ── Project actions ───────────────────────────────────────
  const addProject = useCallback(
    (data: { name: string; description: string; client: string; dueDate: string }) => {
      const id = uid();
      const project: Project = {
        id,
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
      };
      setProjects((prev) => [...prev, project]);
      pushActivity("project_created", "New project created", data.name, id);
    },
    [pushActivity]
  );

  // ── Task actions ──────────────────────────────────────────
  const addTask = useCallback(
    (data: {
      title: string;
      project: string;
      assignee: string;
      priority: Task["priority"];
      dueDate: string;
    }) => {
      const id = uid();
      const task: Task = {
        id,
        title: data.title,
        projectId: "",
        project: data.project || "—",
        assignedTo: "",
        assignee: data.assignee || "Unassigned",
        status: "todo",
        priority: data.priority,
        dueDate: data.dueDate || "TBD",
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [...prev, task]);
      pushActivity("task_created", "New task created", data.title, id);
    },
    [pushActivity]
  );

  const toggleTaskDone = useCallback(
    (id: string) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const isDone = t.status === "done";
          const updated: Task = {
            ...t,
            status: isDone ? "todo" : "done",
            completedAt: isDone ? undefined : new Date().toISOString(),
          };
          if (!isDone) {
            pushActivity("task_completed", "Task completed", t.title, id);
          }
          return updated;
        })
      );
    },
    [pushActivity]
  );

  // ── Member actions ────────────────────────────────────────
  const addMember = useCallback(
    (data: { name: string; role: string; email: string }) => {
      const id = uid();
      const member: TeamMember = {
        id,
        name: data.name,
        role: data.role,
        email: data.email,
        status: "active",
        initials: makeInitials(data.name),
        color: pickColor(),
        projects: 0,
        createdAt: new Date().toISOString(),
      };
      setMembers((prev) => [...prev, member]);
      pushActivity("member_joined", "Team member joined", `${data.name} — ${data.role}`, id);
    },
    [pushActivity]
  );

  // ── Computed values ───────────────────────────────────────
  const activeProjectCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects]
  );
  const totalClientCount = useMemo(() => clients.length, [clients]);
  const openTaskCount = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks]
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
      activeProjectCount,
      totalClientCount,
      openTaskCount,
      teamMemberCount,
      addClient,
      addProject,
      addTask,
      toggleTaskDone,
      addMember,
    ]
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

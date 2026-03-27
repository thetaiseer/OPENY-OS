// ============================================================
// OPENY OS – Seed / Mock Data
// ============================================================
import type { Client, Project, Task, TeamMember, Activity, SystemStatus } from "./types";

// Helper: ISO timestamp N days ago
function daysAgo(n: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ── Clients ──────────────────────────────────────────────────
export const initialClients: Client[] = [
  { id: "c1", name: "Nexus Corp",     company: "Nexus Corp",     email: "contact@nexus.io",      website: "nexus.io",         status: "active",   createdAt: daysAgo(30), initials: "NC", color: "#4f8ef7", projects: 4 },
  { id: "c2", name: "Titan Labs",     company: "Titan Labs",     email: "hello@titanlabs.co",    website: "titanlabs.co",     status: "active",   createdAt: daysAgo(25), initials: "TL", color: "#34d399", projects: 2 },
  { id: "c3", name: "Orion Systems",  company: "Orion Systems",  email: "info@orionsys.com",     website: "orionsys.com",     status: "prospect", createdAt: daysAgo(20), initials: "OS", color: "#a78bfa", projects: 0 },
  { id: "c4", name: "Atlas Ventures", company: "Atlas Ventures", email: "team@atlasvc.com",      website: "atlasvc.com",      status: "active",   createdAt: daysAgo(15), initials: "AV", color: "#fbbf24", projects: 3 },
  { id: "c5", name: "Prism Digital",  company: "Prism Digital",  email: "hi@prismdigital.io",   website: "prismdigital.io",  status: "inactive", createdAt: daysAgo(10), initials: "PD", color: "#8888a0", projects: 1 },
];

// ── Team Members ─────────────────────────────────────────────
export const initialMembers: TeamMember[] = [
  { id: "m1", name: "Alex Chen",     role: "Admin",     email: "alex@openy.os",    status: "active",  initials: "AC", color: "#4f8ef7", projects: 5, createdAt: daysAgo(60) },
  { id: "m2", name: "Sarah Kim",     role: "Designer",  email: "sarah@openy.os",   status: "active",  initials: "SK", color: "#a78bfa", projects: 3, createdAt: daysAgo(55) },
  { id: "m3", name: "Marcus Lee",    role: "Developer", email: "marcus@openy.os",  status: "away",    initials: "ML", color: "#34d399", projects: 7, createdAt: daysAgo(50) },
  { id: "m4", name: "Priya Nair",    role: "Manager",   email: "priya@openy.os",   status: "active",  initials: "PN", color: "#fbbf24", projects: 4, createdAt: daysAgo(45) },
  { id: "m5", name: "James Wright",  role: "Developer", email: "james@openy.os",   status: "active",  initials: "JW", color: "#34d399", projects: 6, createdAt: daysAgo(40) },
  { id: "m6", name: "Luna Torres",   role: "Analyst",   email: "luna@openy.os",    status: "offline", initials: "LT", color: "#8888a0", projects: 2, createdAt: daysAgo(35) },
];

// ── Projects ─────────────────────────────────────────────────
export const initialProjects: Project[] = [
  { id: "p1", name: "Atlas Platform v2",   clientId: "c4", client: "Atlas Ventures", description: "Full platform redesign and API migration",   status: "active",    progress: 68, team: 4, dueDate: "Apr 15", color: "#4f8ef7", createdAt: daysAgo(28) },
  { id: "p2", name: "Nexus Dashboard",     clientId: "c1", client: "Nexus Corp",     description: "Real-time analytics dashboard",              status: "active",    progress: 42, team: 3, dueDate: "May 1",  color: "#34d399", createdAt: daysAgo(22) },
  { id: "p3", name: "Titan Mobile App",    clientId: "c2", client: "Titan Labs",     description: "Cross-platform mobile application",          status: "planning",  progress: 12, team: 2, dueDate: "Jun 30", color: "#a78bfa", createdAt: daysAgo(18) },
  { id: "p4", name: "Prism CMS",           clientId: "c5", client: "Prism Digital",  description: "Content management system overhaul",        status: "review",    progress: 89, team: 3, dueDate: "Mar 30", color: "#fbbf24", createdAt: daysAgo(14) },
  { id: "p5", name: "Orion API Gateway",   clientId: "c3", client: "Orion Systems",  description: "API infrastructure buildout",                status: "planning",  progress: 5,  team: 2, dueDate: "Jul 15", color: "#f87171", createdAt: daysAgo(10) },
  { id: "p6", name: "Nexus Analytics Pro", clientId: "c1", client: "Nexus Corp",     description: "Advanced analytics and reporting module",    status: "active",    progress: 31, team: 3, dueDate: "May 20", color: "#4f8ef7", createdAt: daysAgo(6)  },
  { id: "p7", name: "Atlas Mobile",        clientId: "c4", client: "Atlas Ventures", description: "Native iOS and Android companion app",       status: "planning",  progress: 0,  team: 1, dueDate: "Aug 1",  color: "#34d399", createdAt: daysAgo(4)  },
  { id: "p8", name: "Prism E-commerce",    clientId: "c5", client: "Prism Digital",  description: "Full e-commerce platform rebuild",           status: "completed", progress: 100, team: 5, dueDate: "Mar 15", color: "#a78bfa", createdAt: daysAgo(60) },
];

// ── Tasks (with completedAt for chart) ───────────────────────
export const initialTasks: Task[] = [
  // Current week – done tasks spread Mon→Sun (today-6 to today)
  { id: "t1",  title: "Review API documentation",      projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m1", assignee: "Alex Chen",    status: "done",        priority: "high",   dueDate: "Mar 28", createdAt: daysAgo(7),  completedAt: daysAgo(6, 9) },
  { id: "t2",  title: "Wireframe onboarding screens",  projectId: "p2", project: "Nexus Dashboard",     assignedTo: "m2", assignee: "Sarah Kim",    status: "done",        priority: "medium", dueDate: "Mar 26", createdAt: daysAgo(8),  completedAt: daysAgo(6, 14) },
  { id: "t3",  title: "Design onboarding flow",        projectId: "p2", project: "Nexus Dashboard",     assignedTo: "m2", assignee: "Sarah Kim",    status: "in-progress", priority: "medium", dueDate: "Mar 30", createdAt: daysAgo(5) },
  { id: "t4",  title: "Fix auth token refresh bug",    projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m3", assignee: "Marcus Lee",   status: "in-progress", priority: "high",   dueDate: "Mar 27", createdAt: daysAgo(4) },
  { id: "t5",  title: "Update client contracts",       projectId: "p3", project: "Titan Mobile App",    assignedTo: "m4", assignee: "Priya Nair",   status: "todo",        priority: "medium", dueDate: "Apr 2",  createdAt: daysAgo(3) },
  { id: "t6",  title: "Database schema migration",     projectId: "p4", project: "Prism CMS",           assignedTo: "m5", assignee: "James Wright", status: "done",        priority: "high",   dueDate: "Mar 25", createdAt: daysAgo(8),  completedAt: daysAgo(5, 11) },
  { id: "t7",  title: "Implement dark mode",           projectId: "p2", project: "Nexus Dashboard",     assignedTo: "m2", assignee: "Sarah Kim",    status: "done",        priority: "low",    dueDate: "Mar 24", createdAt: daysAgo(9),  completedAt: daysAgo(5, 16) },
  { id: "t8",  title: "Performance audit",             projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m3", assignee: "Marcus Lee",   status: "todo",        priority: "medium", dueDate: "Apr 5",  createdAt: daysAgo(2) },
  { id: "t9",  title: "Setup CI pipeline",             projectId: "p5", project: "Orion API Gateway",   assignedTo: "m5", assignee: "James Wright", status: "done",        priority: "high",   dueDate: "Mar 25", createdAt: daysAgo(8),  completedAt: daysAgo(4, 10) },
  { id: "t10", title: "Write unit tests",              projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m5", assignee: "James Wright", status: "done",        priority: "medium", dueDate: "Mar 26", createdAt: daysAgo(7),  completedAt: daysAgo(4, 15) },
  { id: "t11", title: "Component library audit",       projectId: "p2", project: "Nexus Dashboard",     assignedTo: "m2", assignee: "Sarah Kim",    status: "done",        priority: "low",    dueDate: "Mar 27", createdAt: daysAgo(6),  completedAt: daysAgo(3, 9) },
  { id: "t12", title: "Define API contracts",          projectId: "p5", project: "Orion API Gateway",   assignedTo: "m1", assignee: "Alex Chen",    status: "done",        priority: "high",   dueDate: "Mar 28", createdAt: daysAgo(6),  completedAt: daysAgo(3, 14) },
  { id: "t13", title: "User research sessions",        projectId: "p3", project: "Titan Mobile App",    assignedTo: "m2", assignee: "Sarah Kim",    status: "done",        priority: "medium", dueDate: "Mar 29", createdAt: daysAgo(5),  completedAt: daysAgo(3, 17) },
  { id: "t14", title: "Finalize color system",         projectId: "p4", project: "Prism CMS",           assignedTo: "m2", assignee: "Sarah Kim",    status: "done",        priority: "low",    dueDate: "Mar 28", createdAt: daysAgo(5),  completedAt: daysAgo(2, 10) },
  { id: "t15", title: "Backend API scaffolding",       projectId: "p6", project: "Nexus Analytics Pro", assignedTo: "m3", assignee: "Marcus Lee",   status: "done",        priority: "high",   dueDate: "Mar 29", createdAt: daysAgo(5),  completedAt: daysAgo(2, 13) },
  { id: "t16", title: "Auth middleware refactor",      projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m5", assignee: "James Wright", status: "done",        priority: "high",   dueDate: "Mar 30", createdAt: daysAgo(4),  completedAt: daysAgo(2, 15) },
  { id: "t17", title: "Deploy staging environment",   projectId: "p4", project: "Prism CMS",           assignedTo: "m3", assignee: "Marcus Lee",   status: "done",        priority: "high",   dueDate: "Mar 30", createdAt: daysAgo(4),  completedAt: daysAgo(1, 9) },
  { id: "t18", title: "QA smoke testing",             projectId: "p4", project: "Prism CMS",           assignedTo: "m4", assignee: "Priya Nair",   status: "done",        priority: "medium", dueDate: "Mar 30", createdAt: daysAgo(4),  completedAt: daysAgo(1, 11) },
  { id: "t19", title: "Sprint planning meeting",      projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m4", assignee: "Priya Nair",   status: "done",        priority: "low",    dueDate: "Mar 31", createdAt: daysAgo(3),  completedAt: daysAgo(1, 14) },
  { id: "t20", title: "Integrate payment gateway",    projectId: "p2", project: "Nexus Dashboard",     assignedTo: "m5", assignee: "James Wright", status: "todo",        priority: "high",   dueDate: "Apr 10", createdAt: daysAgo(1) },
  { id: "t21", title: "Write release notes",          projectId: "p4", project: "Prism CMS",           assignedTo: "m1", assignee: "Alex Chen",    status: "done",        priority: "low",    dueDate: "Apr 1",  createdAt: daysAgo(2),  completedAt: daysAgo(0, 9) },
  { id: "t22", title: "Update README files",          projectId: "p5", project: "Orion API Gateway",   assignedTo: "m1", assignee: "Alex Chen",    status: "done",        priority: "low",    dueDate: "Apr 1",  createdAt: daysAgo(2),  completedAt: daysAgo(0, 11) },
  { id: "t23", title: "Code review – auth module",    projectId: "p1", project: "Atlas Platform v2",   assignedTo: "m3", assignee: "Marcus Lee",   status: "todo",        priority: "high",   dueDate: "Apr 3",  createdAt: daysAgo(1) },
  { id: "t24", title: "Proposal deck",                projectId: "p7", project: "Atlas Mobile",        assignedTo: "m4", assignee: "Priya Nair",   status: "todo",        priority: "medium", dueDate: "Apr 8",  createdAt: daysAgo(0) },
];

// ── Activities ───────────────────────────────────────────────
export const initialActivities: Activity[] = [
  { id: "a1", type: "client_added",      message: "New client added",       detail: "Nexus Corp",                 entityId: "c1", timestamp: daysAgo(30) },
  { id: "a2", type: "member_joined",     message: "Team member joined",     detail: "Sarah Kim — Designer",       entityId: "m2", timestamp: daysAgo(25) },
  { id: "a3", type: "project_created",   message: "New project created",    detail: "Atlas Platform v2",          entityId: "p1", timestamp: daysAgo(22) },
  { id: "a4", type: "task_completed",    message: "Task completed",          detail: "Database schema migration",  entityId: "t6", timestamp: daysAgo(5, 11) },
  { id: "a5", type: "task_completed",    message: "Task completed",          detail: "Implement dark mode",        entityId: "t7", timestamp: daysAgo(5, 16) },
  { id: "a6", type: "project_updated",   message: "Project updated",         detail: "Atlas Platform v2",          entityId: "p1", timestamp: daysAgo(4, 10) },
  { id: "a7", type: "task_completed",    message: "Task completed",          detail: "Setup CI pipeline",          entityId: "t9", timestamp: daysAgo(4, 10) },
  { id: "a8", type: "task_completed",    message: "Task completed",          detail: "Auth middleware refactor",   entityId: "t16", timestamp: daysAgo(2, 15) },
  { id: "a9", type: "report_generated",  message: "Report generated",       detail: "Monthly analytics",          entityId: "r1", timestamp: daysAgo(1, 9) },
  { id: "a10", type: "task_completed",   message: "Task completed",          detail: "QA smoke testing",           entityId: "t18", timestamp: daysAgo(1, 11) },
  { id: "a11", type: "client_added",     message: "New client added",       detail: "Orion Systems",              entityId: "c3", timestamp: daysAgo(0, 8) },
  { id: "a12", type: "task_completed",   message: "Task completed",          detail: "Write release notes",        entityId: "t21", timestamp: daysAgo(0, 9) },
];

// ── System Status ─────────────────────────────────────────────
export const systemStatuses: SystemStatus[] = [
  { name: "API Gateway",       latency: "42ms",  status: "operational" },
  { name: "Database Cluster",  latency: "8ms",   status: "operational" },
  { name: "Auth Service",      latency: "15ms",  status: "operational" },
  { name: "Storage Layer",     latency: "320ms", status: "degraded" },
];

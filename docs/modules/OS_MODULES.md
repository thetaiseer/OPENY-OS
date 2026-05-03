# OPENY OS — Module Specifications

> Operational workspace modules: project management, client tracking, team collaboration.

---

## Dashboard

- **Purpose:** High-level operational overview.
- **Displays:** Total clients, active projects, open/overdue tasks, trends, upcoming tasks, recent activity.
- **Data sources:** `clients`, `projects`, `tasks`, `activities` / `activity_log`

---

## Clients

- **List view:** Avatar, name, industry, status, project/task counts, last activity.
- **Detail view:** Tabs — Overview, Projects, Tasks, Assets, Content, Activity.
- **Actions:** Create, edit, archive, delete, navigate to client-scoped views.

---

## Projects

- **List view:** Project name, linked client, status, due date, budget/progress.
- **Detail view:** Scoped tasks, team assignments, budget tracking, activity trail.
- **Actions:** Create, edit, delete; status transitions.

---

## Tasks

- **Views:** Kanban (To Do → In Progress → Review → Done → Delivered) and List.
- **Fields:** Title, description, status, priority, assignee, due date, project/client linkage.
- **Detail:** Comments, activity, subtasks, attachments, time entries.

---

## Calendar

- Displays tasks, content schedules, and related events by day / week / month.
- Supports creating and editing schedule items with type-aware color coding.

---

## Assets

- Uploads stored in Cloudflare R2; metadata persisted in DB.
- Grid and preview experience with filtering by client / type / date.
- Supports download, delete, categorization, and client linkage.

---

## Content

- Social content lifecycle: `draft` → `scheduled` → `published` (and related states).
- **Fields:** Platform targets, purpose, schedule date, linked client.
- Supports status transitions, creation flow, and AI-assisted improvements.

---

## Reports

- Coverage: Team performance, project progress, task completion, client activity.
- Revenue-oriented summaries derived from accounting sources.
- Chart types: line, bar, donut (as applicable per metric).

---

## Team

- Member directory with role badges and status indicators.
- **Invite flow:** Create invitation → resend / revoke → accept via tokenized link.
- Profile-level detail pages with permission-aware actions.

---

## Activity

- Workspace-wide timeline / audit stream.
- Filterable by user, action type, date range, and entity.

---

## Settings / Security

- Profile preferences, workspace-level settings, notification preferences.
- Session management and credential updates.

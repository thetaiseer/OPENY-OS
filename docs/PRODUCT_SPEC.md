# OPENY Product Specification

## 1) Full Module Specifications

### OPENY OS Modules

#### Dashboard
- Purpose: high-level operational overview.
- Includes: total clients, active projects, open/overdue tasks, trends, upcoming tasks, recent activity.
- Data sources: `clients`, `projects`, `tasks`, `activities`/`activity_log`.

#### Clients
- List: avatar, name, industry, status, project/task counts, last activity.
- Details: tabs for Overview, Projects, Tasks, Assets, Content, Activity.
- Actions: create, edit, archive, delete, navigate to client-scoped views.

#### Projects
- List: project, linked client, status, due date, budget/progress.
- Detail: scoped tasks, team assignments, budget tracking, activity trail.
- Actions: create/edit/delete, status transitions.

#### Tasks
- Views: Kanban (To Do, In Progress, Review, Done, Delivered) and List.
- Fields: title, description, status, priority, assignee, due date, project/client linkage.
- Detail: comments, activity, subtasks, attachments, time entries.

#### Calendar
- Displays tasks, content schedules, and related events by day/week/month.
- Enables creating and editing schedule items with type-aware colors.

#### Assets
- Uploads to Cloudflare R2 with metadata in DB.
- Grid and preview experience with filtering by client/type/date.
- Supports download, delete, categorization, and client linkage.

#### Content
- Social content lifecycle (`draft`, `scheduled`, `published`, etc.).
- Fields: platform targets, purpose, schedule date, linked client.
- Supports status transitions, creation flow, AI-assisted improvements.

#### Reports
- Team performance, project progress, task completion, client activity.
- Revenue-oriented summaries from docs/accounting sources.
- Chart types include line/bar/donut where applicable.

#### Team
- Member directory with role badges and status.
- Invite flow: create invitation, resend/revoke, accept through tokenized links.
- Profile-level detail pages and permission-aware actions.

#### Activity
- Workspace-wide timeline/audit stream.
- Filtering by user/action/date/entity.

#### Settings / Security
- Profile preferences, workspace-level settings, notification settings.
- Session management and credential updates.

---

### OPENY DOCS Modules

#### Invoice
- Structured editor + live A4 preview.
- Platform allocation and branch-level breakdown.
- Actions: save, export (PDF/Excel), print.
- Supports generated and manual invoice composition.

#### Quotation
- Deliverables table (qty, unit price, subtotals), payment terms, totals.
- Live preview and export support.

#### Client Contract
- Bilingual contract workflows (AR/EN), legal clauses, financial terms, signatures.
- Save and export support.

#### HR Contract
- Employee-centric legal contract with compensation/terms/working hours.
- Save and export support.

#### Employees
- Employee records, statuses, hire data, salary values.
- Salary change history and payroll export.

#### Accounting
- Revenue entries + expenses by month.
- Collector/payment type segmentation and net result calculation.
- Export routes for summary artifacts.

---

## 2) Database Schema Overview

### Identity & Workspace
- `auth.users`: Supabase auth identities.
- `profiles`: app profile data and roles.
- `workspace_members`: membership + role bindings.
- `workspaces`: tenant root and settings.

### OS Core
- `clients`
- `projects`
- `tasks`
- `assets`
- `content_items`
- `activities` / `activity_log`
- `comments`
- `time_entries`
- `tags`
- `saved_views`
- `notifications`

### Docs Core
- `docs_invoices`
- `docs_quotations`
- `docs_client_contracts`
- `docs_hr_contracts`
- `docs_employees`
- `docs_salary_history`
- `docs_accounting_entries`
- `docs_accounting_expenses`
- supporting nested invoice tables:
  - `docs_invoice_branches`
  - `docs_invoice_platforms`
  - `docs_invoice_rows`

### Integrations / Ops
- upload/multipart metadata tables
- reminder/cron-related records
- invitation/session support tables

### Relationship Summary
- `workspaces` own operational and docs data.
- `clients` link to `projects`, `tasks`, `assets`, `content_items`, and docs/invoice context.
- `projects` link to many `tasks`.
- `tasks` link to `comments` and `time_entries`.
- docs invoice hierarchy is parent -> branches -> platforms -> rows.

---

## 3) API Routes List

Below is the application route inventory grouped by domain (from `src/app/api/**/route.ts`).

### Auth & Sessions
- `/api/auth/google`
- `/api/auth/google/callback`
- `/api/auth/google/disconnect`
- `/api/auth/google/status`
- `/api/auth/sessions`
- `/api/auth/sessions/check`
- `/api/auth/sessions/[id]`
- `/api/auth/sessions/logout`
- `/api/auth/sessions/activity`
- `/api/auth/sessions/deactivate-current`
- `/api/auth/sessions/revoke-others`
- `/api/auth/workspace-access`

### Core OS Entities
- `/api/clients`
- `/api/projects`
- `/api/projects/[id]`
- `/api/tasks`
- `/api/tasks/[id]`
- `/api/assets`
- `/api/assets/[id]`
- `/api/content-items`
- `/api/content-items/[id]`
- `/api/comments`
- `/api/time-entries`
- `/api/time-entries/[id]`
- `/api/activities`
- `/api/activity-timeline`
- `/api/calendar-events`
- `/api/calendar-events/[id]`
- `/api/tags`
- `/api/tags/[id]`
- `/api/saved-views`
- `/api/saved-views/[id]`
- `/api/entity-links`
- `/api/entity-links/[id]`
- `/api/task-asset-links`

### Team & Invitations
- `/api/team/members`
- `/api/team/members/[id]`
- `/api/team/members/[id]/permissions`
- `/api/team/members/me/permissions`
- `/api/team/workspace-access`
- `/api/team/invite`
- `/api/team/invite/[token]`
- `/api/team/invite/[token]/accept`
- `/api/team/invite/resend`
- `/api/team/invite/revoke`
- `/api/team/invitations`
- `/api/invitations/validate`
- `/api/invitations/accept`

### Notifications, Search, Reports
- `/api/notifications`
- `/api/notifications/[id]`
- `/api/notifications/mark-all-read`
- `/api/notifications/preferences`
- `/api/search`
- `/api/reports/overview`
- `/api/dashboard/trends`
- `/api/dashboard/team-performance`

### Upload / Storage / Sync
- `/api/upload`
- `/api/upload/presign`
- `/api/upload/preview-presign`
- `/api/upload/thumbnail-presign`
- `/api/upload/complete`
- `/api/upload/multipart-init`
- `/api/upload/multipart-part`
- `/api/upload/multipart-complete`
- `/api/upload/multipart-abort`
- `/api/assets/download-zip`
- `/api/assets/sync`
- `/api/assets/sync/cron`
- `/api/assets/cleanup`
- `/api/drive-sync`
- `/api/r2/status`

### Docs APIs
- `/api/docs/invoices`
- `/api/docs/invoices/[id]`
- `/api/docs/invoices/[id]/export`
- `/api/docs/quotations`
- `/api/docs/quotations/[id]`
- `/api/docs/quotations/[id]/export`
- `/api/docs/client-contracts`
- `/api/docs/client-contracts/[id]`
- `/api/docs/client-contracts/[id]/export`
- `/api/docs/hr-contracts`
- `/api/docs/hr-contracts/[id]`
- `/api/docs/hr-contracts/[id]/export`
- `/api/docs/employees`
- `/api/docs/employees/[id]`
- `/api/docs/employees/[id]/salary`
- `/api/docs/employees/payroll-export`
- `/api/docs/accounting/entries`
- `/api/docs/accounting/entries/[id]`
- `/api/docs/accounting/expenses`
- `/api/docs/accounting/expenses/[id]`
- `/api/docs/accounting/export`
- `/api/docs/client-profiles`
- `/api/docs/client-profiles/[id]`
- `/api/docs/backups`
- `/api/docs/backups/[id]`

### AI / Automation / Integrations
- `/api/ai/command`
- `/api/ai/daily-brief`
- `/api/ai/generate-content`
- `/api/ai/generate-tasks`
- `/api/ai/improve`
- `/api/ai/quality-check`
- `/api/ai/suggest-schedule`
- `/api/ai/summarize-report`
- `/api/automations`
- `/api/automations/[id]`
- `/api/reminders/cron`
- `/api/google/connect`
- `/api/google/callback`
- `/api/integrations/slack/test`

---

## 4) Component System Overview

### Design System Principles
- Single visual language for OS and DOCS.
- CSS variable driven theming (`[data-theme='light']` and dark defaults).
- Reusable primitives for consistency and speed.

### Core UI Primitives
- `Button`, `Card`, `Input`, `Textarea`, `SelectDropdown`
- `Badge`, `Avatar`, `Table`, `EmptyState`, `Skeleton`
- `Modal` and `AppModal` (shared modal engine)
- layout primitives: `PageShell`, `PageHeader`, sidebar/topbar wrappers

### Feature Components
- Upload stack (`UploadModal`, queue components)
- Task components (`NewTaskModal`, task detail/edit patterns)
- Content creation (`NewContentModal`)
- Docs workspace components (`DocsWorkspaceShell`, `DocsEditorCard`, preview components)
- Charts and stats (`StatCard`, reports/dashboard chart blocks)

### State & Data Patterns
- Client side caching via TanStack Query.
- Route handlers (`/api/*`) as backend surface.
- Supabase client/server utilities shared via `src/lib`.

### Theming System
- Theme source of truth: `localStorage.theme` and `<html data-theme=...>`.
- Theme boot script in root layout prevents FOUC.
- Tokenized colors in `globals.css` consumed by all modules.

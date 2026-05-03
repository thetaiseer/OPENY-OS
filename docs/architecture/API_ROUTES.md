# API Routes

Full route inventory sourced from `src/app/api/**/route.ts`, grouped by domain.

---

## Auth & Sessions

```
/api/auth/google
/api/auth/google/callback
/api/auth/google/disconnect
/api/auth/google/status
/api/auth/sessions
/api/auth/sessions/check
/api/auth/sessions/[id]
/api/auth/sessions/logout
/api/auth/sessions/activity
/api/auth/sessions/deactivate-current
/api/auth/sessions/revoke-others
/api/auth/workspace-access
```

---

## Core OS Entities

```
/api/clients
/api/projects
/api/projects/[id]
/api/tasks
/api/tasks/[id]
/api/assets
/api/assets/[id]
/api/content-items
/api/content-items/[id]
/api/comments
/api/time-entries
/api/time-entries/[id]
/api/activities
/api/activity-timeline
/api/calendar-events
/api/calendar-events/[id]
/api/tags
/api/tags/[id]
/api/saved-views
/api/saved-views/[id]
/api/entity-links
/api/entity-links/[id]
/api/task-asset-links
```

---

## Team & Invitations

```
/api/team/members
/api/team/members/[id]
/api/team/members/[id]/permissions
/api/team/members/me/permissions
/api/team/workspace-access
/api/team/invite
/api/team/invite/[token]
/api/team/invite/[token]/accept
/api/team/invite/resend
/api/team/invite/revoke
/api/team/invitations
/api/invitations/validate
/api/invitations/accept
```

---

## Notifications, Search & Reports

```
/api/notifications
/api/notifications/[id]
/api/notifications/mark-all-read
/api/notifications/preferences
/api/search
/api/reports/overview
/api/dashboard/trends
/api/dashboard/team-performance
```

---

## Upload / Storage / Sync

```
/api/upload
/api/upload/presign
/api/upload/preview-presign
/api/upload/thumbnail-presign
/api/upload/complete
/api/upload/multipart-init
/api/upload/multipart-part
/api/upload/multipart-complete
/api/upload/multipart-abort
/api/assets/download-zip
/api/assets/sync
/api/assets/sync/cron
/api/assets/cleanup
/api/drive-sync
/api/r2/status
```

---

## Docs

```
# Invoices
/api/docs/invoices
/api/docs/invoices/[id]
/api/docs/invoices/[id]/export

# Quotations
/api/docs/quotations
/api/docs/quotations/[id]
/api/docs/quotations/[id]/export

# Client Contracts
/api/docs/client-contracts
/api/docs/client-contracts/[id]
/api/docs/client-contracts/[id]/export

# HR Contracts
/api/docs/hr-contracts
/api/docs/hr-contracts/[id]
/api/docs/hr-contracts/[id]/export

# Employees
/api/docs/employees
/api/docs/employees/[id]
/api/docs/employees/[id]/salary
/api/docs/employees/payroll-export

# Accounting
/api/docs/accounting/entries
/api/docs/accounting/entries/[id]
/api/docs/accounting/expenses
/api/docs/accounting/expenses/[id]
/api/docs/accounting/export

# Client Profiles & Backups
/api/docs/client-profiles
/api/docs/client-profiles/[id]
/api/docs/backups
/api/docs/backups/[id]
```

---

## AI / Automation / Integrations

```
# AI
/api/ai/command
/api/ai/daily-brief
/api/ai/generate-content
/api/ai/generate-tasks
/api/ai/improve
/api/ai/quality-check
/api/ai/suggest-schedule
/api/ai/summarize-report

# Automations & Reminders
/api/automations
/api/automations/[id]
/api/reminders/cron

# Integrations
/api/google/connect
/api/google/callback
/api/integrations/slack/test
```

# Database Schema Overview

---

## Identity & Workspace

| Table | Description |
|---|---|
| `auth.users` | Supabase auth identities |
| `profiles` | App profile data and roles |
| `workspace_members` | Membership and role bindings |
| `workspaces` | Tenant root and settings |

---

## OS Core Tables

| Table | Notes |
|---|---|
| `clients` | |
| `projects` | |
| `tasks` | |
| `assets` | |
| `content_items` | |
| `activities` / `activity_log` | |
| `comments` | |
| `time_entries` | |
| `tags` | |
| `saved_views` | |
| `notifications` | |

---

## Docs Core Tables

| Table | Notes |
|---|---|
| `docs_invoices` | Parent invoice record |
| `docs_invoice_branches` | Branch-level breakdown (child of invoice) |
| `docs_invoice_platforms` | Platform allocation (child of branch) |
| `docs_invoice_rows` | Line items (child of platform) |
| `docs_quotations` | |
| `docs_client_contracts` | |
| `docs_hr_contracts` | |
| `docs_employees` | |
| `docs_salary_history` | |
| `docs_accounting_entries` | |
| `docs_accounting_expenses` | |

---

## Integrations & Ops Tables

- Upload / multipart metadata
- Reminder / cron-related records
- Invitation / session support

---

## Relationship Summary

```
workspaces
├── clients
│   ├── projects → tasks → comments
│   │                    └── time_entries
│   ├── assets
│   ├── content_items
│   └── docs (invoices, contracts, etc.)
└── docs_invoice hierarchy:
    invoice → branches → platforms → rows
```

- `workspaces` own all operational and docs data (tenant isolation).
- `clients` link to `projects`, `tasks`, `assets`, `content_items`, and docs invoice context.
- `projects` link to many `tasks`.
- `tasks` link to `comments` and `time_entries`.

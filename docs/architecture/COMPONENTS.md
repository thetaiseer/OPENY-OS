# Component System Overview

---

## Design System Principles

- Single visual language shared across OS and DOCS.
- CSS variable-driven theming (`[data-theme='light']` and dark defaults).
- Reusable primitives for consistency and development speed.

---

## Core UI Primitives

| Component | Notes |
|---|---|
| `Button` | |
| `Card` | |
| `Input` | |
| `Textarea` | |
| `SelectDropdown` | |
| `Badge` | |
| `Avatar` | |
| `Table` | |
| `EmptyState` | |
| `Skeleton` | |
| `Modal` / `AppModal` | Shared modal engine |
| `PageShell` | Layout wrapper |
| `PageHeader` | Standard page header |
| Sidebar / Topbar wrappers | Layout primitives |

---

## Feature Components

| Component | Domain |
|---|---|
| `UploadModal`, upload queue components | Asset upload |
| `NewTaskModal`, task detail/edit patterns | Tasks |
| `NewContentModal` | Content |
| `DocsWorkspaceShell`, `DocsEditorCard`, preview components | DOCS modules |
| `StatCard`, chart blocks | Reports / Dashboard |

---

## State & Data Patterns

- **Client-side caching:** TanStack Query
- **Backend surface:** Next.js route handlers at `/api/*`
- **Supabase utilities:** Shared client/server helpers in `src/lib`

---

## Theming System

| Concern | Implementation |
|---|---|
| Theme source of truth | `localStorage.theme` + `<html data-theme="...">` |
| Flash of unstyled content (FOUC) | Boot script injected in root layout |
| Token definitions | CSS custom properties in `globals.css` |

All modules consume the same token set — no per-module color overrides.

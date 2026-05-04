# OPENY Documentation

Welcome to the OPENY project documentation. Use this index to navigate all sections.

---

## Sections

### Product & Roadmap
| Document | Description |
|---|---|
| [Roadmap](./ROADMAP.md) | Delivery phases, milestones, and exit criteria |

### Modules
| Document | Description |
|---|---|
| [OS Modules](./modules/OS_MODULES.md) | Dashboard, Clients, Projects, Tasks, Calendar, Assets, Content, Reports, Team, Activity, Settings |
| [Docs Modules](./modules/DOCS_MODULES.md) | Invoice, Quotation, Client Contract, HR Contract, Employees, Accounting |

### Architecture
| Document | Description |
|---|---|
| [Database Schema](./architecture/DATABASE.md) | Tables, relationships, and data model overview |
| [API Routes](./architecture/API_ROUTES.md) | Full route inventory grouped by domain |
| [Component System](./architecture/COMPONENTS.md) | Design system, UI primitives, state patterns, theming |

---

## Quick Reference

- **Two products**: OPENY OS (operational workspace) + OPENY DOCS (business documents & finance)
- **Stack**: Next.js · Supabase · Cloudflare R2 · TanStack Query
- **Auth**: Supabase Auth with workspace-scoped RBAC (Owner / Admin / Manager / Member / Viewer)

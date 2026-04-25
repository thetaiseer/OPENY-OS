# OPENY Roadmap

This roadmap organizes OPENY delivery into 4 implementation phases.

---

## Phase 1: Core System
Focus: authentication, tenancy, and operational backbone.

### Scope
- Supabase Auth integration and session hardening
- Workspace model and role-based access control
- Core entities: clients, projects, tasks
- Activity logging foundation
- Base design system and shell layout (sidebar/topbar/page shell)

### Deliverables
- Stable login, invite acceptance, and workspace-scoped permissions
- CRUD flows for clients/projects/tasks
- Task board + list views
- Initial dashboard metrics
- Baseline API routes and migrations

### Exit Criteria
- All users only see workspace-scoped data
- Owner/Admin/Manager/Member/Viewer permissions enforced in UI + API
- `npm run type-check` and `npm run build` pass consistently

---

## Phase 2: Docs System
Focus: production-grade business documents and finance flows.

### Scope
- Invoice module with live preview and exports
- Quotation module with editable line items and totals
- Client/HR contract modules (multi-language capable)
- Employees module with salary history
- Accounting module with income/expense ledgers and monthly summaries

### Deliverables
- Save/edit/export workflows for all docs modules
- Client profile linking into docs generation
- Payroll and accounting summary exports
- Cross-linking between employees and HR contracts

### Exit Criteria
- Docs modules are tenant-safe and operational
- Core export endpoints are functional
- Financial totals are deterministic and validated

---

## Phase 3: Advanced Features
Focus: intelligence, automation, and advanced analytics.

### Scope
- AI assistants (content suggestions, summaries, quality checks)
- Automation rules and scheduled/reminder flows
- Enhanced reports (team, client, project, revenue)
- Integrations surface (Google/Slack and sync utilities)

### Deliverables
- AI command flows and guarded API execution
- Automation CRUD + execution patterns
- Expanded dashboard/reporting visuals
- Integration status and diagnostics pages/routes

### Exit Criteria
- AI and automation features are permission-safe and observable
- Reports are actionable for operations and leadership
- Background jobs/cron routes are secured

---

## Phase 4: Polish
Focus: quality, performance, mobile experience, and release readiness.

### Scope
- Performance profiling and rendering optimizations
- Mobile UX refinement and responsive QA
- Accessibility improvements (keyboard/focus/labels)
- Test strategy hardening (unit/integration/e2e coverage targets)
- Production readiness checklists and docs

### Deliverables
- Faster route transitions and reduced hydration/regression issues
- Improved modal/navigation behavior on mobile
- Test suites for critical flows (auth, task flow, docs exports)
- Updated documentation and runbooks

### Exit Criteria
- Performance budgets met for key pages
- Critical user journeys covered by tests
- Release checklist approved for production scale

---

## Suggested Milestones
- M1: Phase 1 complete (core operations stable)
- M2: Phase 2 complete (docs production-ready)
- M3: Phase 3 complete (intelligent workflows enabled)
- M4: Phase 4 complete (quality/performance hardening)

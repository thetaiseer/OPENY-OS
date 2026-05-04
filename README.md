# OPENY — Agency Operating System

OPENY is a unified, multi-tenant SaaS platform for digital marketing agencies, combining:
- **OPENY OS**: daily operations (clients, projects, tasks, team, assets, reports)
- **OPENY DOCS**: business documents (invoices, quotations, contracts, employees, accounting)

OPENY runs as a single Next.js application with shared identity, shared design system, and shared Supabase database.

---

## العربية

### ما هو OPENY؟

OPENY هو نظام تشغيل متكامل للوكالات التسويقية الرقمية، يجمع بين:
- **OPENY OS** لإدارة التشغيل اليومي
- **OPENY DOCS** لإدارة الوثائق المالية والإدارية

كل ذلك داخل تطبيق واحد وهوية واحدة وقاعدة بيانات واحدة.

### التقنيات المستخدمة

- Frontend: Next.js 15 (App Router), React 18, TypeScript
- UI: Tailwind CSS + CSS Variables + Lucide Icons + Recharts
- Data: Supabase (PostgreSQL + Supabase Auth)
- Storage: Cloudflare R2
- State & Data Fetching: TanStack Query v5
- Deployment: Vercel

### المميزات (جميع الوحدات)

#### OPENY OS
- Dashboard
- Clients
- Projects
- Tasks (Kanban + List)
- Calendar
- Assets
- Content
- Reports
- Team
- Activity
- Settings

#### OPENY DOCS
- Invoice
- Quotation
- Client Contract
- HR Contract
- Employees
- Accounting

### الأدوار والصلاحيات

| الدور | الصلاحيات |
|---|---|
| Owner | صلاحيات كاملة + إدارة الفوترة + حذف مساحة العمل |
| Admin | إدارة الفريق والوصول لجميع البيانات |
| Manager | إدارة العملاء/المشاريع/المهام والوصول للوثائق |
| Member | إنشاء/تعديل مهامه وعرض البيانات التشغيلية |
| Viewer | عرض فقط بدون تعديل |

### العلاقات بين البيانات

```text
auth.users
  -> profiles (1:1)
  -> workspace_members (1:many)

workspaces
  -> clients / projects / tasks / assets / content_items / activity_log
  -> docs_invoices / docs_quotations / docs_employees / docs_accounting_entries

clients -> projects -> tasks
clients -> assets / content_items / docs_invoices / activity_log
projects -> tasks
tasks -> comments / time_entries
docs_invoices -> docs_invoice_branches -> docs_invoice_platforms -> docs_invoice_rows
docs_employees -> docs_salary_history
```

### تشغيل المشروع محليًا

1. تثبيت الحزم:
   ```bash
   npm install
   ```
2. إعداد متغيرات البيئة:
   ```bash
   cp .env.example .env.local
   ```
3. تطبيق ترحيلات Supabase (من مجلد `supabase/migrations`).
4. تشغيل بيئة التطوير:
   ```bash
   npm run dev
   ```
5. التحقق قبل النشر:
   ```bash
   npm run type-check
   npm run build
   ```

### متغيرات البيئة المطلوبة

- Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- R2:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`
- App/Email/Jobs:
  - `NEXT_PUBLIC_APP_URL`
  - `CRON_SECRET`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
- AI:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`

### دليل النشر (Vercel + Supabase)

1. أنشئ مشروع Supabase وطبّق جميع ملفات الترحيل.
2. فعّل Supabase Auth (Email/Password) واضبط إعدادات OAuth إذا لزم.
3. أنشئ Bucket على Cloudflare R2 واضبط مفاتيح الوصول وCORS.
4. أنشئ مشروع Vercel واربطه بمستودع GitHub.
5. أضف جميع متغيرات البيئة في Vercel (Production/Preview).
6. تحقق من:
   - اتصال قاعدة البيانات
   - رفع الملفات إلى R2
   - إرسال الإيميلات (Resend)
   - وظائف AI
7. نفّذ نشر Production وتحقق من الصفحات الأساسية وواجهات API.

---

## English

### What is OPENY?

OPENY is an all-in-one, multi-tenant operating system for digital marketing agencies, combining:
- **OPENY OS** for operational workflows
- **OPENY DOCS** for financial and legal documents

Both sections run in one application with one authentication layer and one shared data model.

### Tech Stack

- Frontend: Next.js 15 (App Router), React 18, TypeScript
- UI: Tailwind CSS, CSS variables, Lucide React, Recharts
- Backend/Data: Supabase (PostgreSQL + Supabase Auth)
- File Storage: Cloudflare R2
- State/Data fetching: TanStack Query v5
- Deployment: Vercel

### Feature List (All Modules)

#### OPENY OS
- Dashboard
- Clients
- Projects
- Tasks (Kanban + List)
- Calendar
- Assets
- Content
- Reports
- Team
- Activity
- Settings

#### OPENY DOCS
- Invoice
- Quotation
- Client Contract
- HR Contract
- Employees
- Accounting

### User Roles and Permissions

| Role | Permissions |
|---|---|
| Owner | Full access, billing control, workspace deletion |
| Admin | Team management, global data access |
| Manager | Manage clients/projects/tasks and docs workflows |
| Member | Create/update own tasks, operational visibility |
| Viewer | Read-only access |

### Data Relationships

```text
auth.users
  -> profiles
  -> workspace_members

workspaces
  -> clients / projects / tasks / assets / content_items / activity_log
  -> docs_invoices / docs_quotations / docs_employees / docs_accounting_entries

clients -> projects -> tasks
projects -> tasks
tasks -> comments / time_entries
docs_invoices -> docs_invoice_branches -> docs_invoice_platforms -> docs_invoice_rows
docs_employees -> docs_salary_history
```

### Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env file:
   ```bash
   cp .env.example .env.local
   ```
3. Run Supabase migrations from `supabase/migrations`.
4. Start dev server:
   ```bash
   npm run dev
   ```
5. Validate:
   ```bash
   npm run type-check
   npm run build
   ```

### Required Environment Variables

- Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- Cloudflare R2:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`
- App/Email/Cron:
  - `NEXT_PUBLIC_APP_URL`
  - `CRON_SECRET`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
- AI:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`

### Deployment Guide (Vercel + Supabase)

1. Create a Supabase project and apply all migrations.
2. Configure Supabase Auth providers and redirect URLs.
3. Create and configure an R2 bucket + API credentials + CORS.
4. Create a Vercel project and connect the GitHub repo.
5. Add all environment variables in Vercel for Production/Preview.
6. Deploy and validate:
   - auth flows
   - workspace-scoped data
   - uploads/downloads
   - docs exports
   - API endpoints

---

## Documentation

- Documentation index: [`docs/README.md`](docs/README.md)
- OS modules: [`docs/modules/OS_MODULES.md`](docs/modules/OS_MODULES.md)
- Docs modules: [`docs/modules/DOCS_MODULES.md`](docs/modules/DOCS_MODULES.md)
- Database schema: [`docs/architecture/DATABASE.md`](docs/architecture/DATABASE.md)
- API routes: [`docs/architecture/API_ROUTES.md`](docs/architecture/API_ROUTES.md)
- Component system: [`docs/architecture/COMPONENTS.md`](docs/architecture/COMPONENTS.md)
- Delivery roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)

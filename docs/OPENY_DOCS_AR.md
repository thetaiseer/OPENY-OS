# شرح نظام OPENY DOCS من واقع ملفات الريبو الحالية

هذا المستند يشرح جزء **OPENY DOCS** كما يظهر في الريبو الحالي `OPENY-OS`. النسخة الحالية ليست تطبيق HTML/JavaScript ثابت، بل جزء داخل تطبيق Next.js/TypeScript أكبر باسم **OPENY OS**.

الملفات التي تم الاعتماد عليها تشمل:

- `README.md`
- `package.json`
- `.env.example`
- `src/app/docs/page.tsx`
- `src/app/docs/*/page.tsx`
- `src/modules/docs/pages/*`
- `src/app/api/docs/**/route.ts`
- `src/lib/docs-types.ts`
- `src/lib/docs-invoices-db.ts`
- `src/lib/docs-invoice-excel.ts`
- `src/lib/docs-print.ts`
- `src/lib/ai-provider.ts`
- `supabase/full-schema.sql`
- `supabase/migrations/*`

## 1. وظيفة النظام الأساسية

OPENY DOCS هو نظام لإدارة المستندات المالية والإدارية داخل OPENY OS. يوفر ست وحدات رئيسية:

1. Invoice
2. Quotation
3. Client Contract
4. HR Contract
5. Employees
6. Accounting

صفحة الدخول لهذه الوحدات موجودة في `src/app/docs/page.tsx`، وتعرض كروت تنقل إلى:

- `/docs/invoice`
- `/docs/quotation`
- `/docs/client-contract`
- `/docs/hr-contract`
- `/docs/employees`
- `/docs/accounting`

كل صفحة Route في `src/app/docs/.../page.tsx` تستدعي صفحة فعلية من `src/modules/docs/pages`. على سبيل المثال، `src/app/docs/invoice/page.tsx` يعرض `InvoicePage` من `src/modules/docs/pages/invoice-page.tsx`.

## 2. طبيعة التطبيق الحالية

النظام الحالي يعمل كتطبيق:

- Next.js 15 App Router
- React 18
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL/Auth
- Cloudflare R2 للتخزين
- Vercel للنشر

هذا يعني أن OPENY DOCS لم يعد يعتمد على ملفات مباشرة مثل `index.html` و`script.js` في الجذر، ولا يعتمد على عميل Supabase مكشوف بالكامل على `window`. المنطق الحالي موزع بين صفحات React، API Routes، ومكتبات داخل `src/lib`.

## 3. المكونات الرئيسية

### أ. طبقة الواجهة

المسار الأساسي:

- `src/app/docs/page.tsx`

هذا الملف يعرض شاشة اختيار نوع المستند. الكروت الستة تستخدم روابط Next.js مباشرة إلى وحدات المستندات.

صفحات الوحدات:

- `src/modules/docs/pages/invoice-page.tsx`
- `src/modules/docs/pages/invoice-history-page.tsx`
- `src/modules/docs/pages/quotation-page.tsx`
- `src/modules/docs/pages/client-contract-page.tsx`
- `src/modules/docs/pages/hr-contract-page.tsx`
- `src/modules/docs/pages/employees-page.tsx`
- `src/modules/docs/pages/accounting-page.tsx`

مكونات مساعدة مهمة:

- `src/components/docs/DocsWorkspace.tsx`
- `src/components/docs/DocsUi.tsx`
- `src/components/docs/DocumentDesign.tsx`
- `src/components/docs/invoice/InvoicePreview.tsx`
- `src/components/docs/invoice/BranchTable.tsx`
- `src/components/docs/invoice/TotalsSection.tsx`

### ب. طبقة API

OPENY DOCS يتعامل مع البيانات عبر Next.js API Routes في `src/app/api/docs`.

أهم المسارات:

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
- `/api/docs/accounting/expenses`
- `/api/docs/accounting/transfers`
- `/api/docs/accounting/month-meta`
- `/api/docs/backups`
- `/api/docs/client-profiles`

### ج. طبقة قاعدة البيانات

قاعدة البيانات الأساسية هي Supabase/PostgreSQL. الجداول المهمة تظهر في `supabase/full-schema.sql` وملفات الترحيل داخل `supabase/migrations`.

جداول OPENY DOCS الأساسية:

- `docs_invoices`
- `docs_invoice_branches`
- `docs_invoice_platforms`
- `docs_invoice_rows`
- `docs_quotations`
- `docs_client_contracts`
- `docs_hr_contracts`
- `docs_employees`
- `docs_salary_history`
- `docs_accounting_entries`
- `docs_accounting_expenses`
- `docs_accounting_transfers`
- `docs_accounting_month_meta`
- `docs_client_document_profiles`

### د. طبقة التخزين

التخزين الحالي موجه إلى Cloudflare R2، وليس Supabase Storage كخيار رئيسي. هذا واضح من `.env.example` ومن ملفات:

- `src/lib/r2.ts`
- `src/lib/storage/r2.ts`
- `src/lib/storage/service.ts`
- `src/lib/client-r2-upload.ts`
- `src/app/api/upload/**`

الملفات المصدرة أو المرفوعة تمر غالبا عبر API Routes ثم R2.

## 4. مسؤولية كل جزء

### `src/app/docs/page.tsx`

مسؤول عن شاشة اختيار وحدات OPENY DOCS. يعرض الكروت الستة ويوجه المستخدم إلى Route كل وحدة.

### `src/modules/docs/pages/invoice-page.tsx`

مسؤول عن محرر الفواتير. من الملفات الظاهرة، يدعم:

- بيانات العميل
- رقم الفاتورة
- شهر الحملة
- تاريخ الفاتورة
- العملة
- حالة الدفع
- رسوم OPENY
- تقسيمات الفروع والمنصات والحملات
- معاينة A4
- حفظ الفاتورة
- تصدير PDF/Excel
- قوالب فواتير مثل Pro Icon KSA

### `src/lib/docs-invoices-db.ts`

مسؤول عن منطق مساعد للفواتير، خصوصا:

- تطبيع بنية الفروع والمنصات والحملات
- حساب إجماليات الفاتورة
- قراءة الجداول المتداخلة:
  - `docs_invoice_branches`
  - `docs_invoice_platforms`
  - `docs_invoice_rows`
- التعامل مع أخطاء غياب الجداول أو تضارب أرقام الفواتير

### `src/lib/docs-print.ts`

مسؤول عن تصدير المعاينة إلى PDF من خلال `html2pdf.js`.

### `src/lib/docs-invoice-excel.ts`

مسؤول عن بناء ملف Excel للفواتير باستخدام ExcelJS.

### `src/lib/docs-doc-numbers.ts`

مسؤول عن توليد أو التحقق من أرقام المستندات المتسلسلة مثل `INV` للفواتير.

### `src/lib/ai-provider.ts`

مسؤول عن الاتصال بمزود AI. حسب `.env.example`، الإعدادات المطلوبة هي:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

وظائف AI لا تستخدم مفتاحا مكشوفا داخل الواجهة، بل تمر من خلال السيرفر/API.

## 5. تدفق فتح وحدة مستند

```text
User opens /docs
-> src/app/docs/page.tsx
-> user clicks a document card
-> Next.js navigates to /docs/invoice or another docs route
-> route file in src/app/docs/*/page.tsx
-> page component from src/modules/docs/pages/*
-> component fetches data from /api/docs/*
-> API route reads/writes Supabase
```

## 6. تدفق حفظ فاتورة

```text
Invoice editor state
-> POST /api/docs/invoices or PATCH /api/docs/invoices/[id]
-> API route validates/normalizes payload
-> Supabase docs_invoices
-> nested invoice tables for branches/platforms/rows when applicable
-> response returns saved invoice data
-> UI reloads or updates local state
```

الجداول المتداخلة للفواتير مهمة لأن الفاتورة ليست صفا واحدا فقط. يوجد هيكل:

```text
docs_invoices
  -> docs_invoice_branches
      -> docs_invoice_platforms
          -> docs_invoice_rows
```

## 7. تدفق التصدير

### PDF

```text
Preview component
-> exportPreviewPdf in src/lib/docs-print.ts
-> html2pdf.js
-> PDF file generated from the rendered preview
```

### Excel

```text
Invoice data/model
-> src/lib/docs-invoice-excel.ts
-> ExcelJS workbook
-> downloadable Excel artifact
```

بعض API Routes تحتوي أيضا على مسارات export مثل `/api/docs/invoices/[id]/export` لتوليد أو تحديث روابط التصدير المرتبطة بالسجل.

## 8. التقنيات المستخدمة

من الملفات الحالية، التقنيات المؤكدة هي:

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS
- Lucide React
- Recharts
- Supabase SSR
- Supabase JS
- PostgreSQL
- Cloudflare R2
- ExcelJS
- html2pdf.js
- html2canvas
- jsPDF
- pdfjs-dist
- Gemini API من خلال إعدادات السيرفر
- Vercel

## 9. إعدادات البيئة المطلوبة

من `.env.example`، أهم المتغيرات:

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`
- `SUPABASE_SERVICE_ROLE_KEY`

### Cloudflare R2

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

### التطبيق والمهام

- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

### البريد

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `INVITE_FROM_EMAIL`
- `EMAIL_FROM`

### الذكاء الاصطناعي

- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## 10. تشغيل المشروع محليا

```bash
npm install
cp .env.example .env.local
npm run dev
```

قبل النشر أو تسليم تغيير كبير:

```bash
npm run type-check
npm run build
npm run test
```

ملاحظة: `README.md` يذكر تطبيق ترحيلات Supabase من مجلد `supabase/migrations`. يجب التأكد من تطبيق الترحيلات المطلوبة قبل اختبار وحدات OPENY DOCS.

## 11. نقاط الأمان والمخاطر

1. **RLS يحتاج مراجعة إنتاجية**

   في `supabase/full-schema.sql` توجد سياسات على جداول docs باسم `*_auth` تسمح للـ authenticated role باستخدام `USING (true) WITH CHECK (true)` في مواضع متعددة. هذا أفضل من فتح `anon`، لكنه لا يكفي وحده لعزل بيانات كل workspace إذا لم تكن كل API Routes تضيف فلترة workspace واضحة.

2. **التحقق من workspace isolation**

   بما أن OPENY OS متعدد المساحات، يجب التأكد أن كل API Route في `/api/docs` يقرأ ويكتب داخل `workspace_id` الصحيح فقط.

3. **R2 public access**

   `R2_PUBLIC_URL` يعني أن الملفات قد تكون قابلة للوصول عبر URL عام. يجب ضبط أسماء المفاتيح، الصلاحيات، وحذف الملفات بعناية.

4. **AI يحتاج إعداد سيرفر**

   وظائف Gemini تعتمد على `GEMINI_API_KEY`. عدم ضبط المفتاح يجعل وظائف AI غير مفعلة أو ترجع خطأ إعداد.

5. **وجود Firebase في dependencies**

   `package.json` ما زال يحتوي على `firebase`، رغم أن التخزين والبيانات الحالية الأساسية ظاهرة كـ Supabase/R2. يحتاج هذا إلى قرار: إما استخدام فعلي موثق أو تنظيف dependency غير مستخدم.

6. **تعدد مسارات قديمة وجديدة**

   توجد مسارات مثل `/invoice` و`/quotation` بالإضافة إلى `/docs/invoice` و`/docs/quotation`. يجب تحديد المسارات الرسمية للمستخدم النهائي وتوثيق أي redirects أو legacy routes.

## 12. نقاط غير مؤكدة

- لم يتم تنفيذ مراجعة كاملة لكل ملف TSX طويل داخل وحدات docs.
- لم يتم التأكد من كل سياسات RLS في كل migration على حدة.
- لم يتم التحقق عمليا من export PDF/Excel عبر تشغيل المتصفح.
- لم يتم التأكد من أن كل روابط التصدير تحفظ في قاعدة البيانات أو R2 بنفس النمط.
- لم يتم تحديد ما إذا كانت مسارات `/invoice` و`/quotation` legacy أم واجهات مقصودة.

## 13. ملخص تنفيذي

OPENY DOCS في الريبو الحالي هو جزء من تطبيق Next.js/TypeScript متعدد المستأجرين. يوفر وحدات لإنشاء وإدارة الفواتير، عروض الأسعار، عقود العملاء، عقود HR، الموظفين، والمحاسبة. الواجهة مبنية بمكونات React داخل `src/modules/docs/pages`، والبيانات تمر عبر API Routes في `src/app/api/docs` إلى Supabase. التخزين الحالي موجه إلى Cloudflare R2، والتصدير يستخدم مكتبات مثل `html2pdf.js` وExcelJS. أهم ما يحتاج مراجعة قبل الإنتاج هو عزل البيانات حسب workspace، سياسات RLS، إعدادات R2، وتشغيل اختبارات تصدير المستندات.

## 14. خريطة ذهنية نصية

```text
OPENY DOCS
|
|-- UI Routes
|   |-- src/app/docs/page.tsx
|   |-- src/app/docs/invoice/page.tsx
|   |-- src/app/docs/quotation/page.tsx
|   |-- src/app/docs/client-contract/page.tsx
|   |-- src/app/docs/hr-contract/page.tsx
|   |-- src/app/docs/employees/page.tsx
|   `-- src/app/docs/accounting/page.tsx
|
|-- Page Logic
|   |-- src/modules/docs/pages/invoice-page.tsx
|   |-- src/modules/docs/pages/invoice-history-page.tsx
|   |-- src/modules/docs/pages/quotation-page.tsx
|   |-- src/modules/docs/pages/client-contract-page.tsx
|   |-- src/modules/docs/pages/hr-contract-page.tsx
|   |-- src/modules/docs/pages/employees-page.tsx
|   `-- src/modules/docs/pages/accounting-page.tsx
|
|-- API Layer
|   |-- src/app/api/docs/invoices
|   |-- src/app/api/docs/quotations
|   |-- src/app/api/docs/client-contracts
|   |-- src/app/api/docs/hr-contracts
|   |-- src/app/api/docs/employees
|   |-- src/app/api/docs/accounting
|   |-- src/app/api/docs/backups
|   `-- src/app/api/docs/client-profiles
|
|-- Data Layer
|   |-- Supabase PostgreSQL
|   |-- docs_invoices
|   |-- docs_invoice_branches/platforms/rows
|   |-- docs_quotations
|   |-- docs_client_contracts
|   |-- docs_hr_contracts
|   |-- docs_employees
|   `-- docs_accounting_*
|
|-- Storage
|   |-- Cloudflare R2
|   |-- src/lib/r2.ts
|   `-- src/lib/storage/*
|
|-- Export
|   |-- src/lib/docs-print.ts
|   |-- src/lib/docs-invoice-excel.ts
|   |-- html2pdf.js
|   `-- ExcelJS
|
`-- Main Risks
    |-- Workspace isolation
    |-- Broad authenticated RLS policies
    |-- R2 public URL exposure
    |-- AI env configuration
    `-- Legacy route/dependency cleanup
```

## 15. خطوات استلام OPENY DOCS

1. راجع `README.md` و `.env.example`.
2. اضبط Supabase وطبّق كل migrations.
3. اضبط Cloudflare R2 والمتغيرات الخاصة به.
4. شغل التطبيق محليا عبر `npm run dev`.
5. افتح `/docs`.
6. جرّب كل وحدة:
   - Invoice
   - Quotation
   - Client Contract
   - HR Contract
   - Employees
   - Accounting
7. اختبر إنشاء/تعديل/حذف السجلات.
8. اختبر تصدير PDF وExcel.
9. راجع أن كل البيانات مرتبطة بـ `workspace_id` الصحيح.
10. شغل:

```bash
npm run type-check
npm run build
npm run test
```

11. قبل الإنتاج، راجع RLS وR2 وCRON وAI والبريد.

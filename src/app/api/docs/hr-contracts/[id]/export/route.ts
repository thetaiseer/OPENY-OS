import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { OPENY_LOGO_LIGHT_URL } from '@/lib/openy-brand';

interface Params { id: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { getApiUser } = await import('@/lib/api-auth');
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const logoUrl = new URL(OPENY_LOGO_LIGHT_URL, req.nextUrl.origin).toString();
  const db = getServiceClient();
  const { data, error } = await db.from('docs_hr_contracts').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const c = data as Record<string, unknown> & {
    contract_number:        string;
    contract_date:          string | null;
    status:                 string;
    currency:               string;
    language:               string;
    company_name:           string | null;
    company_representative: string | null;
    employee_full_name:     string;
    job_title:              string | null;
    department:             string | null;
    employment_type:        string | null;
    start_date:             string | null;
    salary:                 number;
    payment_method:         string | null;
    payment_date:           string | null;
    benefits:               string[];
    daily_hours:            number;
    work_days:              string | null;
    annual_leave:           number;
    legal_clauses:          Array<{ title: string; content: string }>;
    sig_company_rep:        string | null;
    sig_employee_name:      string | null;
    sig_date:               string | null;
    sig_place:              string | null;
  };

  const isAr = c.language === 'ar';
  const clauses = (c.legal_clauses ?? [])
    .map((cl, i) => `<p><strong>${i + 1}. ${cl.title}</strong><br>${cl.content}</p>`)
    .join('');
  const benefits = (c.benefits ?? []).map(b => `<li>${b}</li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${c.contract_number}</title>
<style>
body{font-family:Arial,sans-serif;max-width:840px;margin:0 auto;padding:34px 40px;font-size:13px;color:#0f172a}
.head{display:flex;justify-content:space-between;align-items:flex-start;background:#0b0f19;color:#fff;padding:20px 24px;border-radius:10px}
.brand{text-align:right}
.brand img{width:120px;height:34px;object-fit:contain}
h1{margin:0;font-size:22px;letter-spacing:.5px}
.section{margin-bottom:16px;padding:12px 16px;border:1px solid #dbe0e6;border-radius:8px;background:#f8fafc}
table{width:100%;border-collapse:collapse}td{padding:6px 10px;border-bottom:1px solid #dbe0e6}
.sig-box{display:inline-block;width:45%;text-align:center;min-height:60px;border-bottom:1px solid #c6ced8;margin-top:40px}
.meta{color:#64748b}
</style></head>
<body>
<div class="head">
  <div>
    <h1>${isAr ? 'عقد عمل' : 'EMPLOYMENT CONTRACT'}</h1>
    <p class="meta">${c.contract_number} &middot; ${c.contract_date ?? ''}</p>
  </div>
  <div class="brand"><img src="${logoUrl}" alt="OPENY" /></div>
</div>
<p style="text-align:center;color:#64748b;margin:14px 0 18px">Official OPENY HR Agreement</p>
<div class="section"><table>
<tr>
<td><strong>${isAr ? 'الشركة' : 'Company'}:</strong></td><td>${c.company_name ?? ''}</td>
<td><strong>${isAr ? 'الممثل' : 'Representative'}:</strong></td><td>${c.company_representative ?? ''}</td>
</tr><tr>
<td><strong>${isAr ? 'الموظف' : 'Employee'}:</strong></td><td>${c.employee_full_name}</td>
<td><strong>${isAr ? 'المسمى الوظيفي' : 'Job Title'}:</strong></td><td>${c.job_title ?? ''}</td>
</tr><tr>
<td><strong>${isAr ? 'القسم' : 'Department'}:</strong></td><td>${c.department ?? ''}</td>
<td><strong>${isAr ? 'نوع التوظيف' : 'Type'}:</strong></td><td>${c.employment_type ?? ''}</td>
</tr><tr>
<td><strong>${isAr ? 'تاريخ البداية' : 'Start Date'}:</strong></td><td>${c.start_date ?? ''}</td>
<td><strong>${isAr ? 'الحالة' : 'Status'}:</strong></td><td>${c.status}</td>
</tr>
</table></div>
<div class="section">
<strong>${isAr ? 'الراتب' : 'Salary'}:</strong> ${c.salary} ${c.currency}/month &nbsp;
<strong>${isAr ? 'طريقة الدفع' : 'Payment'}:</strong> ${c.payment_method ?? ''} &nbsp;
<strong>${isAr ? 'تاريخ الدفع' : 'Pay Date'}:</strong> ${c.payment_date ?? ''}
</div>
<div class="section">
<strong>${isAr ? 'ساعات العمل' : 'Work Hours'}:</strong> ${c.daily_hours}h/day &nbsp;
<strong>${isAr ? 'أيام العمل' : 'Work Days'}:</strong> ${c.work_days ?? ''} &nbsp;
<strong>${isAr ? 'الإجازة السنوية' : 'Annual Leave'}:</strong> ${c.annual_leave} ${isAr ? 'يوم' : 'days'}
</div>
${benefits ? `<div class="section"><strong>${isAr ? 'المزايا' : 'Benefits'}:</strong><ul>${benefits}</ul></div>` : ''}
${clauses ? `<div class="section"><strong>${isAr ? 'البنود القانونية' : 'Legal Clauses'}:</strong>${clauses}</div>` : ''}
<div style="margin-top:40px;display:flex;justify-content:space-between">
<div class="sig-box">${c.sig_company_rep ?? ''}<br><small>${isAr ? 'ممثل الشركة' : 'Company Representative'}</small></div>
<div class="sig-box">${c.sig_employee_name ?? ''}<br><small>${isAr ? 'الموظف' : 'Employee'}</small></div>
</div>
<p style="text-align:center;margin-top:8px;font-size:11px;color:#64748b">${c.sig_place ?? ''} ${c.sig_date ?? ''}</p>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${c.contract_number}.html"`,
    },
  });
}

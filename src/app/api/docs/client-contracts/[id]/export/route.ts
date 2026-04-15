import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';

interface Params { id: string }

export async function GET(_: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.from('docs_client_contracts').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const c = data as Record<string, unknown> & {
    contract_number:       string;
    contract_date:         string | null;
    duration_months:       number;
    status:                string;
    currency:              string;
    language:              string;
    party1_company_name:   string | null;
    party1_representative: string | null;
    party2_client_name:    string | null;
    party2_contact_person: string | null;
    services:              string[];
    total_value:           number;
    payment_method:        string | null;
    payment_terms:         string | null;
    notes:                 string | null;
    legal_clauses:         Array<{ title: string; content: string }>;
    sig_party1:            string | null;
    sig_party2:            string | null;
    sig_date:              string | null;
    sig_place:             string | null;
  };

  const isAr = c.language === 'ar';
  const clauses = (c.legal_clauses ?? [])
    .map((cl, i) => `<p><strong>${i + 1}. ${cl.title}</strong><br>${cl.content}</p>`)
    .join('');
  const services = (c.services ?? []).map(s => `<li>${s}</li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head><meta charset="UTF-8"><title>${c.contract_number}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;font-size:13px}
h1{text-align:center;color:#0891b2}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
td,th{padding:6px 10px}th{background:#f3f4f6;text-align:left}
.section{margin-bottom:20px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px}
.sig-box{display:inline-block;width:45%;text-align:center;min-height:60px;border-bottom:1px solid #d1d5db;margin-top:40px}
</style></head>
<body>
<h1>${isAr ? 'عقد خدمات' : 'SERVICE CONTRACT'}</h1>
<p style="text-align:center;color:#6b7280">${c.contract_number} &middot; ${c.contract_date ?? ''}</p>
<div class="section">
<table><tr>
<td><strong>${isAr ? 'مدة العقد' : 'Duration'}:</strong></td><td>${c.duration_months} ${isAr ? 'شهر' : 'months'}</td>
<td><strong>${isAr ? 'الحالة' : 'Status'}:</strong></td><td>${c.status}</td>
</tr><tr>
<td><strong>${isAr ? 'العملة' : 'Currency'}:</strong></td><td>${c.currency}</td>
<td></td><td></td>
</tr></table>
</div>
<div class="section"><strong>${isAr ? 'الطرف الأول' : 'Party 1'}:</strong> ${c.party1_company_name ?? ''} — ${c.party1_representative ?? ''}</div>
<div class="section"><strong>${isAr ? 'الطرف الثاني' : 'Party 2'}:</strong> ${c.party2_client_name ?? ''} — ${c.party2_contact_person ?? ''}</div>
${services ? `<div class="section"><strong>${isAr ? 'الخدمات' : 'Services'}:</strong><ul>${services}</ul></div>` : ''}
<div class="section">
<strong>${isAr ? 'القيمة الإجمالية' : 'Total Value'}:</strong> ${c.total_value} ${c.currency}
&nbsp; <strong>${isAr ? 'طريقة الدفع' : 'Payment'}:</strong> ${c.payment_method ?? ''}
</div>
${clauses ? `<div class="section"><strong>${isAr ? 'البنود القانونية' : 'Legal Clauses'}:</strong>${clauses}</div>` : ''}
<div style="margin-top:40px;display:flex;justify-content:space-between">
<div class="sig-box">${c.sig_party1 ?? ''}<br><small>${isAr ? 'الطرف الأول' : 'Party 1'}</small></div>
<div class="sig-box">${c.sig_party2 ?? ''}<br><small>${isAr ? 'الطرف الثاني' : 'Party 2'}</small></div>
</div>
<p style="text-align:center;margin-top:8px;font-size:11px;color:#6b7280">${c.sig_place ?? ''} ${c.sig_date ?? ''}</p>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${c.contract_number}.html"`,
    },
  });
}

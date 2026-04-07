/**
 * POST /api/clients
 *
 * Creates a new client record.
 *
 * Auth: requires 'admin', 'manager', or 'team' role.
 *
 * Request body (JSON):
 *   { name, email?, phone?, website?, industry?, status?, notes? }
 *
 * Success response:
 *   { success: true, client: { ...createdClient } }
 *
 * Error response:
 *   { success: false, step: "validation" | "db_insert", error: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export async function POST(request: NextRequest) {
  console.log('[POST /api/clients] request received');

  // 1. Auth & role check
  const auth = await requireRole(request, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  console.log('[POST /api/clients] caller:', auth.profile.email, '| role:', auth.profile.role);

  // 2. Parse request body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn('[POST /api/clients] body parse error:', err);
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  console.log('[POST /api/clients] payload:', JSON.stringify(body));

  // 3. Validate required fields
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    console.warn('[POST /api/clients] validation failed: name is empty');
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Company name is required' },
      { status: 400 },
    );
  }

  // 4. Build insert payload (only allow known fields)
  const insertPayload: Record<string, string> = { name };
  const optionalFields = ['email', 'phone', 'website', 'industry', 'status', 'notes'] as const;
  for (const field of optionalFields) {
    const val = body[field];
    if (typeof val === 'string' && val.trim() !== '') {
      insertPayload[field] = val.trim();
    }
  }

  // Use 'active' as the default status if not provided
  if (!insertPayload.status) {
    insertPayload.status = 'active';
  }

  console.log('[POST /api/clients] db insert payload:', JSON.stringify(insertPayload));

  // 5. DB insert (service-role bypasses RLS — role already verified above)
  if (!supabaseServiceRoleKey) {
    console.error('[POST /api/clients] SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json(
      { success: false, step: 'db_insert', error: 'Server configuration error' },
      { status: 500 },
    );
  }

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await db
    .from('clients')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('[POST /api/clients] db_insert error — code:', error.code, '| message:', error.message);
    return NextResponse.json(
      { success: false, step: 'db_insert', error: error.message },
      { status: 500 },
    );
  }

  console.log('[POST /api/clients] insert success — id:', data?.id);

  return NextResponse.json({ success: true, client: data });
}

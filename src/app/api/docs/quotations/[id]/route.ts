import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { dbDocumentNumberIsUnique } from '@/lib/docs-doc-numbers';

interface Params {
  id: string;
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['viewer', 'team_member', 'manager', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.from('docs_quotations').select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ quotation: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const db = getServiceClient();

  const nextNum = typeof body.quote_number === 'string' ? body.quote_number.trim() : undefined;
  if (nextNum) {
    const { data: current } = await db
      .from('docs_quotations')
      .select('quote_number')
      .eq('id', id)
      .maybeSingle();
    const prevNum = (current as { quote_number?: string } | null)?.quote_number?.trim();
    if (nextNum !== prevNum) {
      const unique = await dbDocumentNumberIsUnique(db, 'docs_quotations', nextNum, id);
      if (!unique) {
        return NextResponse.json(
          {
            error:
              'This quote number is already used by another quotation. Choose a different number.',
            code: 'duplicate_document_number',
          },
          { status: 409 },
        );
      }
    }
  }

  const { data, error } = await db
    .from('docs_quotations')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const dup = error.code === '23505';
    return NextResponse.json(
      {
        error: dup
          ? 'This document number is already in use. Choose a different number.'
          : error.message,
        ...(dup ? { code: 'duplicate_document_number' as const } : {}),
      },
      { status: dup ? 409 : 500 },
    );
  }
  return NextResponse.json({ quotation: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('docs_quotations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

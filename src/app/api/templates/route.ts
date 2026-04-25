/**
 * GET  /api/templates        — list templates
 * POST /api/templates        — create a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

const VALID_ENTITY_TYPES = ['task', 'client', 'project', 'content'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entity_type');

  const db = getServiceClient();
  let query = db.from('content_items').select('*, items:template_items(*)').order('name');

  if (entityType) query = query.eq('entity_type', entityType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const entityType = typeof body.entity_type === 'string' ? body.entity_type : '';

  if (!name)
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  if (!(VALID_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return NextResponse.json({ success: false, error: 'Invalid entity_type' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('content_items')
    .insert({
      name,
      entity_type: entityType,
      description: typeof body.description === 'string' ? body.description.trim() : null,
      template_data: typeof body.template_data === 'object' ? body.template_data : {},
      is_global: body.is_global === true,
      created_by: auth.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Insert template items if provided
  if (Array.isArray(body.items) && data?.id) {
    const itemRows = (body.items as Record<string, unknown>[]).map((item, i) => ({
      template_id: data.id,
      title: typeof item.title === 'string' ? item.title.trim() : 'Untitled',
      description: typeof item.description === 'string' ? item.description : null,
      item_type: typeof item.item_type === 'string' ? item.item_type : 'task',
      sort_order: typeof item.sort_order === 'number' ? item.sort_order : i,
      item_data: typeof item.item_data === 'object' ? item.item_data : {},
    }));
    await db.from('content_items').insert(itemRows);
  }

  return NextResponse.json({ success: true, template: data }, { status: 201 });
}

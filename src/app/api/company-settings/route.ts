import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET /api/company-settings — return the singleton settings row
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('company_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// PATCH /api/company-settings — update the singleton row
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const allowed = [
    'combat_crews_target', 'tech_members_target',
    'spare_commanders', 'spare_gunners', 'spare_loaders', 'spare_drivers',
  ];

  const update: Record<string, number> = {};
  for (const field of allowed) {
    if (field in body && typeof body[field] === 'number') {
      update[field] = Math.max(0, Math.round(body[field]));
    }
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  update['updated_at' as keyof typeof update] = Date.now() as unknown as number;

  const admin = createAdminClient();

  // Upsert: ensure at least one row exists, then update it
  const { data: existing } = await admin.from('company_settings').select('id').limit(1).single();

  if (existing) {
    const { error } = await admin
      .from('company_settings')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from('company_settings')
      .insert({ ...update, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = await admin.from('company_settings').select('*').limit(1).single();
  return NextResponse.json({ settings: data });
}

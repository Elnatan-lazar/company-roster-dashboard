import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// GET /api/configs → list all deployment configs (public read)
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deployment_configs')
    .select('*')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data });
}

// POST /api/configs → create a new config (requires canEdit)
export async function POST(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller)          return NextResponse.json({ error: 'Unauthorized' },              { status: 401 });
  if (!caller.canEdit)  return NextResponse.json({ error: 'אין הרשאות עריכה' },          { status: 403 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'שם נדרש' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deployment_configs')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data }, { status: 201 });
}

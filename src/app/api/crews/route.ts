import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// GET /api/crews → list all crews (public read)
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.from('crews').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crews: data });
}

// POST /api/crews → create a new crew (requires canEdit)
export async function POST(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller)         return NextResponse.json({ error: 'Unauthorized' },    { status: 401 });
  if (!caller.canEdit) return NextResponse.json({ error: 'אין הרשאות עריכה' }, { status: 403 });

  const { name, platoon_id } = await request.json();
  if (!name?.trim() || !platoon_id) {
    return NextResponse.json({ error: 'name and platoon_id required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('crews')
    .insert({ name: name.trim(), platoon_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crew: data });
}

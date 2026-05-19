import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET /api/crews — list all crews
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.from('crews').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crews: data });
}

// POST /api/crews — create a new crew in a platoon
export async function POST(request: NextRequest) {
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

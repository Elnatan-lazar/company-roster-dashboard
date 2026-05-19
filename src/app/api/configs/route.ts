import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET  /api/configs  → list all deployment configs
export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deployment_configs')
    .select('*')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configs: data });
}

// POST /api/configs  → create a new config
// Body: { name: string }
export async function POST(request: NextRequest) {
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

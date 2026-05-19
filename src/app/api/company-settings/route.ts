import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET /api/company-settings → Fetch the company settings row
export async function GET() {
  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from('company_settings')
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

// PATCH /api/company-settings → Update or Insert company metrics targets
export async function PATCH(request: NextRequest) {
  const update = await request.json();
  const admin = createAdminClient() as any;

  // 1. Check if a settings row already exists
  const { data: existing, error: fetchError } = await admin
    .from('company_settings')
    .select('id')
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  if (existing) {
    // 2. Row exists -> Update it
    const { error } = await admin
      .from('company_settings')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // 3. Table is completely empty -> Insert a new row
    const { error } = await admin
      .from('company_settings')
      .insert({ ...update, updated_at: new Date().toISOString() });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 4. Fetch the final updated object to return clean data to the client UI
  const { data: finalSettings, error: finalError } = await admin
    .from('company_settings')
    .select('*')
    .maybeSingle();

  if (finalError) return NextResponse.json({ error: finalError.message }, { status: 500 });
  return NextResponse.json({ settings: finalSettings });
}
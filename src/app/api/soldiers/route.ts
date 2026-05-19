import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// POST /api/soldiers — create a new soldier in the users table
// Body: { first_name, last_name, personal_id, email, role?, primary_platoon_id? }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { first_name, last_name, personal_id, email, role, primary_platoon_id } = body;

  if (!first_name?.trim() || !last_name?.trim() || !personal_id?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'שם פרטי, שם משפחה, מספר אישי ואימייל הם שדות חובה' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check for duplicate email
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'כתובת האימייל כבר קיימת במערכת' }, { status: 409 });
  }

  // Check for duplicate personal_id
  const { data: existingId } = await admin
    .from('users')
    .select('id')
    .eq('personal_id', personal_id.trim())
    .maybeSingle();

  if (existingId) {
    return NextResponse.json({ error: 'מספר אישי כבר קיים במערכת' }, { status: 409 });
  }

  const { data, error } = await admin
    .from('users')
    .insert({
      first_name:         first_name.trim(),
      last_name:          last_name.trim(),
      personal_id:        personal_id.trim(),
      email:              email.trim().toLowerCase(),
      role:               role ?? 'soldier',
      primary_platoon_id: primary_platoon_id ?? null,
      status:             'available',
      medical_fitness:    false,
      can_edit_roster:    false,
      can_view_feedback:  false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ soldier: data }, { status: 201 });
}

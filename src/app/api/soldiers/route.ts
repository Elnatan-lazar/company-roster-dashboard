import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// POST /api/soldiers — create a new soldier (requires canEdit)
// Flow: create auth.users entry first (so the FK is satisfied), then
// insert the profile row into public.users using the returned auth ID.
export async function POST(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller)          return NextResponse.json({ error: 'Unauthorized' },        { status: 401 });
  if (!caller.canEdit)  return NextResponse.json({ error: 'אין הרשאות עריכה' }, { status: 403 });

  const body = await request.json();
  const { first_name, last_name, personal_id, email, role, crew_position, primary_platoon_id } = body;

  if (!first_name?.trim() || !last_name?.trim() || !personal_id?.trim() || !email?.trim()) {
    return NextResponse.json(
      { error: 'שם פרטי, שם משפחה, מספר אישי ואימייל הם שדות חובה' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  // Duplicate checks against public.users
  const { data: existingEmail } = await admin
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingEmail) {
    return NextResponse.json({ error: 'כתובת האימייל כבר קיימת במערכת' }, { status: 409 });
  }

  const { data: existingPersonalId } = await admin
    .from('users')
    .select('id')
    .eq('personal_id', personal_id.trim())
    .maybeSingle();

  if (existingPersonalId) {
    return NextResponse.json({ error: 'מספר אישי כבר קיים במערכת' }, { status: 409 });
  }

  // Step 1: create the auth record — this generates the canonical UUID
  // email_confirm: true means they can log in once a password is set (via reset flow)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
  });

  if (authError) {
    // If Supabase auth already has this email we treat it as a conflict
    if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'כתובת האימייל כבר רשומה במערכת האימות' }, { status: 409 });
    }
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const authUserId = authData.user?.id;
  if (!authUserId) {
    return NextResponse.json({ error: 'לא התקבל מזהה משתמש מהאימות' }, { status: 500 });
  }

  // Step 2: insert the public profile row using the auth user's ID
  const { data, error } = await admin
    .from('users')
    .insert({
      id:                 authUserId,
      first_name:         first_name.trim(),
      last_name:          last_name.trim(),
      personal_id:        personal_id.trim(),
      email:              normalizedEmail,
      role:               role ?? 'soldier',
      crew_position:      crew_position ?? null,
      primary_platoon_id: primary_platoon_id ?? null,
      status:             'available',
      medical_fitness:    true,
      can_edit_roster:    false,
      can_view_feedback:  false,
      is_admin:           false,
    })
    .select()
    .single();

  if (error) {
    // Clean up the orphan auth record so we don't leave dangling accounts
    await admin.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ soldier: data }, { status: 201 });
}

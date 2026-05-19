import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// Excel bulk import API — only company_commander can call this
// Receives parsed rows from the frontend Excel parser
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const adminSupabase = createAdminClient();

  // Verify the calling user is company_commander
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'company_commander') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = await request.json() as {
    rows: Array<{
      personal_id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone_number?: string;
      role: string;
      crew_position?: string;
    }>;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }

  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (const row of rows) {
    // Add to whitelist first
    await adminSupabase
      .from('email_whitelist')
      .upsert({ email: row.email.toLowerCase(), added_by: user.id })
      .select();

    // Create Supabase Auth user if doesn't exist
    const { data: authUser, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: row.email.toLowerCase(),
        email_confirm: true,  // pre-verified since imported by commander
      });

    if (authError && authError.message !== 'User already registered') {
      results.errors.push(`${row.email}: ${authError.message}`);
      continue;
    }

    const userId = authUser?.user?.id;

    // Upsert into users table (by personal_id to handle re-imports)
    const { error: upsertError } = await adminSupabase
      .from('users')
      .upsert(
        {
          id: userId,
          personal_id: row.personal_id,
          email: row.email.toLowerCase(),
          first_name: row.first_name,
          last_name: row.last_name,
          phone_number: row.phone_number ?? null,
          role: row.role as any,
          crew_position: row.crew_position as any ?? null,
        },
        { onConflict: 'personal_id' }
      );

    if (upsertError) {
      results.errors.push(`${row.personal_id}: ${upsertError.message}`);
    } else {
      userId ? results.created++ : results.updated++;
    }
  }

  // Write audit log
  await adminSupabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'BULK_IMPORT',
    target_table: 'users',
    details: { total: rows.length, created: results.created, updated: results.updated, errors: results.errors.length },
  });

  return NextResponse.json(results);
}

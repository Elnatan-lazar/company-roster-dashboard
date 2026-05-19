import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

// Whitelist check: email must exist in the `users` table (pre-created by a commander).
// Returns 200 if found, 403 with Hebrew error message if not.
export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: 'האימייל אינו מופיע ברשימת הסד"כ הפלוגתית, אנא פנה לסגל הפיקוד.' },
      { status: 403 }
    );
  }

  return NextResponse.json({ allowed: true }, { status: 200 });
}

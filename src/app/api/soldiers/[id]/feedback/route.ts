import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

const OFFICER_ROLES = ['company_commander', 'platoon_commander', 'crew_commander'] as const;

// GET /api/soldiers/[id]/feedback  → list feedback for a soldier
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getAuthenticatedUser();

  if (!OFFICER_ROLES.includes(currentUser.role as never)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Fetch feedback + author names via join
  const { data: feedback, error } = await admin
    .from('feedback')
    .select('*')
    .eq('soldier_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach author names
  const authorIds = [...new Set((feedback ?? []).map(f => f.author_id))];
  const { data: authors } = await admin
    .from('users')
    .select('id, first_name, last_name')
    .in('id', authorIds);

  const authorMap = Object.fromEntries(
    (authors ?? []).map(a => [a.id, `${a.first_name} ${a.last_name}`])
  );

  const enriched = (feedback ?? []).map(f => ({
    ...f,
    author_name: authorMap[f.author_id] ?? 'לא ידוע',
  }));

  return NextResponse.json({ feedback: enriched });
}

// POST /api/soldiers/[id]/feedback  → add feedback note
// Body: { content: string, is_private: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const currentUser = await getAuthenticatedUser();

  if (!OFFICER_ROLES.includes(currentUser.role as never)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { content, is_private } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'תוכן נדרש' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('feedback')
    .insert({
      author_id:  currentUser.id,
      soldier_id: params.id,
      content:    content.trim(),
      is_private: Boolean(is_private),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data }, { status: 201 });
}

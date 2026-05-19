import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// GET /api/soldiers/[id]/feedback → list feedback (requires canViewFeedback)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCallerProfile(request);
  if (!caller)                  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.canViewFeedback)  return NextResponse.json({ error: 'Forbidden' },    { status: 403 });

  const admin = createAdminClient();

  const { data: feedback, error } = await admin
    .from('feedback')
    .select('*')
    .eq('soldier_id', params.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const authorIds = [...new Set((feedback ?? []).map((f: { author_id: string }) => f.author_id))];
  const { data: authors } = await admin
    .from('users')
    .select('id, first_name, last_name')
    .in('id', authorIds);

  const authorMap = Object.fromEntries(
    (authors ?? []).map((a: { id: string; first_name: string; last_name: string }) =>
      [a.id, `${a.first_name} ${a.last_name}`]
    )
  );

  const enriched = (feedback ?? []).map((f: Record<string, unknown>) => ({
    ...f,
    author_name: authorMap[f.author_id as string] ?? 'לא ידוע',
  }));

  return NextResponse.json({ feedback: enriched });
}

// POST /api/soldiers/[id]/feedback → add feedback note (requires canViewFeedback)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCallerProfile(request);
  if (!caller)                 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.canViewFeedback) return NextResponse.json({ error: 'Forbidden' },    { status: 403 });

  const { content, is_private } = await request.json();
  if (!content?.trim()) return NextResponse.json({ error: 'תוכן נדרש' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('feedback')
    .insert({
      author_id:  caller.userId,
      soldier_id: params.id,
      content:    content.trim(),
      is_private: Boolean(is_private),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data }, { status: 201 });
}

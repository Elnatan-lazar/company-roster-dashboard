import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// GET /api/activity-logs → list recent actions (requires canEdit)
export async function GET(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller)          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!caller.canEdit)  return NextResponse.json({ error: 'Forbidden' },    { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  // If the table does not exist yet, return an empty list gracefully
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ logs: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with actor names
  const actorIds = [...new Set((data ?? []).map((l: { actor_id: string | null }) => l.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await admin.from('users').select('id, first_name, last_name').in('id', actorIds)
    : { data: [] };

  const actorMap = Object.fromEntries(
    (actors ?? []).map((a: { id: string; first_name: string; last_name: string }) =>
      [a.id, `${a.first_name} ${a.last_name}`],
    ),
  );

  const logs = (data ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    actor_name: l.actor_id ? (actorMap[l.actor_id as string] ?? 'לא ידוע') : 'מערכת',
  }));

  return NextResponse.json({ logs });
}

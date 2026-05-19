import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET /api/leave-requests?platoonId=...
// Returns leave requests with soldier name and platoon info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platoonId = searchParams.get('platoonId');

  const admin = createAdminClient();

  let query = admin
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false });

  // If platoonId filter requested, join to users
  const { data: requests, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!requests || requests.length === 0) {
    return NextResponse.json({ requests: [] });
  }

  // Enrich with soldier info
  const soldierIds = [...new Set(requests.map(r => r.soldier_id))];
  const { data: soldiers } = await admin
    .from('users')
    .select('id, first_name, last_name, primary_platoon_id')
    .in('id', soldierIds);

  const soldierMap = Object.fromEntries(
    (soldiers ?? []).map(s => [s.id, s])
  );

  let enriched = requests.map(r => ({
    ...r,
    soldier_name:    soldierMap[r.soldier_id]
      ? `${soldierMap[r.soldier_id].first_name} ${soldierMap[r.soldier_id].last_name}`
      : 'לא ידוע',
    platoon_id: soldierMap[r.soldier_id]?.primary_platoon_id ?? null,
  }));

  if (platoonId) {
    enriched = enriched.filter(r => r.platoon_id === platoonId);
  }

  return NextResponse.json({ requests: enriched });
}

// POST /api/leave-requests
// Body: { soldier_id, start_date, end_date, leave_time?, reason? }
export async function POST(request: NextRequest) {
  const { soldier_id, start_date, end_date, leave_time, reason } = await request.json();

  if (!soldier_id || !start_date || !end_date) {
    return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 });
  }

  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: 'תאריך סיום חייב להיות אחרי תאריך התחלה' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('leave_requests')
    .insert({
      soldier_id,
      start_date,
      end_date,
      leave_time: leave_time ?? null,
      reason:     reason ?? null,
      status:     'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// DELETE /api/platoons/[id]
// Admin-only. Cascades: removes all deployment assignments for the platoon's
// crews, clears primary_platoon_id on members, deletes crews, then the platoon.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const caller = await getCallerProfile(request);
  if (!caller)         return NextResponse.json({ error: 'Unauthorized' },       { status: 401 });
  if (!caller.isAdmin) return NextResponse.json({ error: 'אין הרשאות מנהל' },   { status: 403 });

  const admin     = createAdminClient();
  const platoonId = params.id;

  // Collect crew IDs that belong to this platoon
  const { data: crewRows } = await admin
    .from('crews')
    .select('id')
    .eq('platoon_id', platoonId);

  const crewIds = (crewRows ?? []).map((c: { id: string }) => c.id);

  // Remove deployment assignments that reference any of these crews
  if (crewIds.length > 0) {
    await admin.from('deployment_assignments').delete().in('crew_id', crewIds);
    // Clear crew_id on users assigned to these crews
    await admin.from('users').update({ crew_id: null, crew_position: null }).in('crew_id', crewIds);
    await admin.from('crews').delete().in('id', crewIds);
  }

  // Clear primary_platoon_id for all soldiers in this platoon
  await admin.from('users').update({ primary_platoon_id: null }).eq('primary_platoon_id', platoonId);

  // Delete the platoon itself
  const { error } = await admin.from('platoons').delete().eq('id', platoonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

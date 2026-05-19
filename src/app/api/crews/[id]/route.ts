import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// DELETE /api/crews/[id] → delete crew + clear all member assignments (requires canEdit)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCallerProfile(request);
  if (!caller)         return NextResponse.json({ error: 'Unauthorized' },    { status: 401 });
  if (!caller.canEdit) return NextResponse.json({ error: 'אין הרשאות עריכה' }, { status: 403 });

  const admin  = createAdminClient();
  const crewId = params.id;

  await admin.from('users').update({ crew_id: null, crew_position: null }).eq('crew_id', crewId);
  await admin.from('deployment_assignments').delete().eq('crew_id', crewId);

  const { error } = await admin.from('crews').delete().eq('id', crewId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

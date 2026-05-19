import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// DELETE /api/crews/[id]
// 1. Clears crew_id + crew_position for all members (users table)
// 2. Removes all deployment_assignments for this crew
// 3. Deletes the crew itself
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin  = createAdminClient();
  const crewId = params.id;

  await admin
    .from('users')
    .update({ crew_id: null, crew_position: null })
    .eq('crew_id', crewId);

  await admin
    .from('deployment_assignments')
    .delete()
    .eq('crew_id', crewId);

  const { error } = await admin
    .from('crews')
    .delete()
    .eq('id', crewId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

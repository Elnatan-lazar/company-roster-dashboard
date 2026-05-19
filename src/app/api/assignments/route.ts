import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET /api/assignments?configId=xxx  → fetch all assignments for a config
export async function GET(request: NextRequest) {
  const configId = new URL(request.url).searchParams.get('configId');
  if (!configId) return NextResponse.json({ error: 'configId required' }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('deployment_assignments')
    .select('*')
    .eq('config_id', configId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data });
}

// POST /api/assignments  → assign a soldier to a crew slot
// Body: { configId, userId, crewId, positionLabel }
export async function POST(request: NextRequest) {
  const { configId, userId, crewId, positionLabel } = await request.json();
  if (!configId || !userId || !crewId || !positionLabel) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Upsert: soldier can only be in one slot per config
  const { error } = await admin
    .from('deployment_assignments')
    .upsert(
      { config_id: configId, user_id: userId, crew_id: crewId, position_label: positionLabel },
      { onConflict: 'config_id,user_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/assignments  → unassign a soldier from their current slot
// Body: { configId, userId }
export async function DELETE(request: NextRequest) {
  const { configId, userId } = await request.json();
  if (!configId || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('deployment_assignments')
    .delete()
    .eq('config_id', configId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

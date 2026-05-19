import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// GET /api/assignments?configId=xxx → fetch all assignments (public read)
export async function GET(request: NextRequest) {
  const configId = new URL(request.url).searchParams.get('configId');
  if (!configId) return NextResponse.json({ error: 'configId required' }, { status: 400 });

  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from('deployment_assignments')
    .select('*')
    .eq('config_id', configId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data });
}

// POST /api/assignments → assign a soldier to a crew slot (requires canEdit)
export async function POST(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller)         return NextResponse.json({ error: 'Unauthorized' },    { status: 401 });
  if (!caller.canEdit) return NextResponse.json({ error: 'אין הרשאות עריכה' }, { status: 403 });

  const { configId, userId, crewId, positionLabel } = await request.json();
  if (!configId || !userId || !crewId || !positionLabel) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient() as any;
  const { error } = await admin
    .from('deployment_assignments')
    .upsert(
      { config_id: configId, user_id: userId, crew_id: crewId, position_label: positionLabel },
      { onConflict: 'config_id,user_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/assignments → unassign a soldier (requires canEdit)
export async function DELETE(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller)         return NextResponse.json({ error: 'Unauthorized' },    { status: 401 });
  if (!caller.canEdit) return NextResponse.json({ error: 'אין הרשאות עריכה' }, { status: 403 });

  const { configId, userId } = await request.json();
  if (!configId || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const admin = createAdminClient() as any;
  const { error } = await admin
    .from('deployment_assignments')
    .delete()
    .eq('config_id', configId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

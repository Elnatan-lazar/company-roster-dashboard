import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// DELETE /api/configs/[id]  → delete a config (guard: at least 1 must remain)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient();

  const { count } = await admin
    .from('deployment_configs')
    .select('*', { count: 'exact', head: true });

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: 'לא ניתן למחוק — חייבת להישאר לפחות תצורה אחת.' },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from('deployment_configs')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST /api/configs/[id]?action=duplicate  → duplicate a config with all its assignments
// Body: { name: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('action') !== 'duplicate') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'שם נדרש' }, { status: 400 });

  const admin = createAdminClient();

  // Create new config
  const { data: newConfig, error: cfgErr } = await admin
    .from('deployment_configs')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (cfgErr) return NextResponse.json({ error: cfgErr.message }, { status: 500 });

  // Copy all assignments from source config
  const { data: srcAssignments, error: srcErr } = await admin
    .from('deployment_assignments')
    .select('user_id, crew_id, position_label')
    .eq('config_id', params.id);

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });

  if (srcAssignments && srcAssignments.length > 0) {
    const inserts = srcAssignments.map(a => ({
      config_id:      newConfig.id,
      user_id:        a.user_id,
      crew_id:        a.crew_id,
      position_label: a.position_label,
    }));

    const { error: insErr } = await admin
      .from('deployment_assignments')
      .insert(inserts);

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ config: newConfig }, { status: 201 });
}

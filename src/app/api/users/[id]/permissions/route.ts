import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/users/[id]/permissions
// Body: { can_edit_roster?: boolean, can_view_feedback?: boolean, is_admin?: boolean }
// Only is_admin users may call this endpoint.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const admin    = createAdminClient();

  // Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify caller has is_admin flag
  const { data: caller } = await admin.from('users').select('is_admin').eq('id', user.id).single();
  if (!caller?.is_admin) {
    return NextResponse.json({ error: 'Only admins can modify permissions' }, { status: 403 });
  }

  const body = await request.json() as Record<string, unknown>;

  const patch: Record<string, boolean> = {};
  if (typeof body.can_edit_roster   === 'boolean') patch.can_edit_roster   = body.can_edit_roster;
  if (typeof body.can_view_feedback === 'boolean') patch.can_view_feedback = body.can_view_feedback;
  if (typeof body.is_admin          === 'boolean') patch.is_admin          = body.is_admin;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid permission fields provided' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('users')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

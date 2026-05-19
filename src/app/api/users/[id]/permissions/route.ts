import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// PATCH /api/users/[id]/permissions
// Body: { can_edit_roster?: boolean, can_view_feedback?: boolean, is_admin?: boolean }
// Only is_admin users may call this endpoint.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCallerProfile(request);
  if (!caller)          return NextResponse.json({ error: 'Unauthorized' },                    { status: 401 });
  if (!caller.isAdmin)  return NextResponse.json({ error: 'Only admins can modify permissions' }, { status: 403 });

  const body = await request.json() as Record<string, unknown>;

  const patch: Record<string, boolean> = {};
  if (typeof body.can_edit_roster   === 'boolean') patch.can_edit_roster   = body.can_edit_roster;
  if (typeof body.can_view_feedback === 'boolean') patch.can_view_feedback = body.can_view_feedback;
  if (typeof body.is_admin          === 'boolean') patch.is_admin          = body.is_admin;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid permission fields provided' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

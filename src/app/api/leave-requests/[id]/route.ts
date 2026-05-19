import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// PATCH /api/leave-requests/[id]
// Body: { status: 'approved' | 'pending', approved_by?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status, approved_by } = await request.json();

  if (!['pending', 'approved'].includes(status)) {
    return NextResponse.json({ error: 'סטטוס לא חוקי' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('leave_requests')
    .update({
      status,
      approved_by:  status === 'approved' ? (approved_by ?? null) : null,
      approved_at:  status === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}

// DELETE /api/leave-requests/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('leave_requests')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

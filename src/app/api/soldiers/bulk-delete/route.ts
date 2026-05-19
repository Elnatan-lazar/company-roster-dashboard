import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// DELETE /api/soldiers/bulk-delete
// Body: { ids: string[] }
export async function DELETE(request: NextRequest) {
  const { ids } = await request.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'יש לספק רשימת מזהים למחיקה' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Guard: never delete the only company_commander
  const { data: mups } = await admin
    .from('users')
    .select('id')
    .eq('role', 'company_commander');

  const mupIds        = (mups ?? []).map(m => m.id);
  const deletingMupIds = ids.filter(id => mupIds.includes(id));

  if (deletingMupIds.length > 0 && mupIds.length <= deletingMupIds.length) {
    return NextResponse.json(
      { error: 'לא ניתן למחוק את מפקד הפלוגה מבלי למנות מחליף תחילה', mup_guard: true },
      { status: 422 }
    );
  }

  const { error } = await admin
    .from('users')
    .delete()
    .in('id', ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: ids.length });
}

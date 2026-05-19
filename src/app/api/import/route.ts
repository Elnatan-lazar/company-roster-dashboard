import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

// GET /api/import  → download the blank Excel template
export async function GET() {
  const headers = [
    'מספר אישי', 'שם פרטי', 'שם משפחה', 'טלפון', 'אימייל',
    'מחלקה', 'צוות', 'תפקיד בצוות',
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = [12,10,12,14,24,14,10,14].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'תבנית');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="roster_template.xlsx"',
    },
  });
}

// POST /api/import?configId=xxx  → parse uploaded xlsx and update users + assignments
// Expects multipart/form-data with a field named "file"
export async function POST(request: NextRequest) {
  const configId = new URL(request.url).searchParams.get('configId');
  if (!configId) return NextResponse.json({ error: 'configId required' }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb   = XLSX.read(arrayBuffer, { type: 'array' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

  const admin = createAdminClient();

  // Fetch lookup maps
  const [{ data: platoons }, { data: crews }, { data: users }] = await Promise.all([
    admin.from('platoons').select('id, name'),
    admin.from('crews').select('id, name, platoon_id'),
    admin.from('users').select('id, personal_id'),
  ]);

  const platoonByName = Object.fromEntries((platoons ?? []).map(p => [p.name, p.id]));
  const crewByName    = Object.fromEntries((crews    ?? []).map(c => [c.name, { id: c.id, platoon_id: c.platoon_id }]));
  const userByPid     = Object.fromEntries((users    ?? []).map(u => [u.personal_id, u.id]));

  const results = { updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const personalId    = String(row['מספר אישי'] ?? '').trim();
    const platoonName   = String(row['מחלקה']     ?? '').trim();
    const crewName      = String(row['צוות']      ?? '').trim();
    const positionLabel = String(row['תפקיד בצוות'] ?? '').trim();

    if (!personalId) { results.skipped++; continue; }

    const userId = userByPid[personalId];
    if (!userId) {
      results.errors.push(`מ"א ${personalId} לא נמצא`);
      results.skipped++;
      continue;
    }

    // Update basic user fields if provided
    const phoneNumber = String(row['טלפון'] ?? '').trim();
    if (phoneNumber) {
      await admin.from('users').update({ phone_number: phoneNumber }).eq('id', userId);
    }

    // Update assignment if crew info is provided
    if (crewName && positionLabel) {
      const crewInfo = crewByName[crewName];
      if (crewInfo) {
        await admin.from('deployment_assignments').upsert(
          { config_id: configId, user_id: userId, crew_id: crewInfo.id, position_label: positionLabel },
          { onConflict: 'config_id,user_id' }
        );

        // Also update primary_platoon_id if platoon info found
        const platoonId = platoonName ? platoonByName[platoonName] : crewInfo.platoon_id;
        if (platoonId) {
          await admin.from('users').update({ primary_platoon_id: platoonId }).eq('id', userId);
        }
      }
    }

    results.updated++;
  }

  return NextResponse.json({ success: true, ...results });
}

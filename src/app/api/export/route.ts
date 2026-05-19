import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { STATUS_LABELS } from '@/types/database';

// GET /api/export?configId=xxx  → download current roster as .xlsx
export async function GET(request: NextRequest) {
  const configId = new URL(request.url).searchParams.get('configId');
  if (!configId) return NextResponse.json({ error: 'configId required' }, { status: 400 });

  const admin = createAdminClient();

  const [
    { data: users },
    { data: platoons },
    { data: crews },
    { data: assignments },
    { data: configs },
  ] = await Promise.all([
    admin.from('users').select('*').order('last_name'),
    admin.from('platoons').select('*').order('platoon_number'),
    admin.from('crews').select('*').order('name'),
    admin.from('deployment_assignments').select('*').eq('config_id', configId),
    admin.from('deployment_configs').select('*').eq('id', configId),
  ]);

  const configName = configs?.[0]?.name ?? 'סד"כ';

  const platoonMap = Object.fromEntries((platoons ?? []).map(p => [p.id, p.name]));
  const crewMap    = Object.fromEntries((crews    ?? []).map(c => [c.id, c.name]));
  const assignMap  = Object.fromEntries(
    (assignments ?? []).map(a => [a.user_id, { crew_id: a.crew_id, position_label: a.position_label }])
  );

  const rows = (users ?? []).map(u => {
    const a = assignMap[u.id];
    return {
      'מספר אישי':    u.personal_id,
      'שם פרטי':      u.first_name,
      'שם משפחה':     u.last_name,
      'טלפון':        u.phone_number ?? '',
      'אימייל':       u.email,
      'מחלקה':        platoonMap[u.primary_platoon_id ?? ''] ?? '',
      'צוות':         a?.crew_id ? (crewMap[a.crew_id] ?? '') : 'לא משובץ',
      'תפקיד בצוות': a?.position_label ?? 'לא משובץ',
      'סטטוס':        STATUS_LABELS[u.status],
      'כשירות רפואית': u.medical_fitness ? 'כן' : 'לא',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['מספר אישי','שם פרטי','שם משפחה','טלפון','אימייל','מחלקה','צוות','תפקיד בצוות','סטטוס','כשירות רפואית'],
  });

  // Column widths
  ws['!cols'] = [12,10,12,14,24,14,10,14,10,14].map(wch => ({ wch }));

  XLSX.utils.book_append_sheet(wb, ws, configName);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(configName)}.xlsx"`,
    },
  });
}

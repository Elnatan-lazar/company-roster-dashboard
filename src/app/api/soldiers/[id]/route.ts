import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { SoldierStatus, UserRole, CrewPosition } from '@/types/database';

const VALID_STATUSES:   SoldierStatus[] = ['available', 'leave', 'mission', 'sick'];
const VALID_ROLES:      UserRole[]      = ['company_commander', 'platoon_commander', 'crew_commander', 'soldier'];
const VALID_POSITIONS:  CrewPosition[]  = ['commander', 'gunner', 'loader', 'driver'];

const ALLOWED_FIELDS = [
  'status', 'first_name', 'last_name', 'phone_number', 'personal_id',
  'role', 'primary_platoon_id', 'crew_id', 'crew_position',
  'medical_fitness', 'medical_fitness_notes', 'shooting_qualification_date',
  'can_edit_roster', 'can_view_feedback',
] as const;

// PATCH /api/soldiers/[id] — update one or more profile fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  const update: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  if ('status' in update && !VALID_STATUSES.includes(update.status as SoldierStatus))
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  if ('role' in update && !VALID_ROLES.includes(update.role as UserRole))
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  if ('crew_position' in update && update.crew_position !== null
    && !VALID_POSITIONS.includes(update.crew_position as CrewPosition))
    return NextResponse.json({ error: 'Invalid crew_position' }, { status: 400 });

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update(update)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// GET /api/soldiers/[id] — get single soldier profile
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ soldier: data });
}

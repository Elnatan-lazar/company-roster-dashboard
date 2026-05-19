import { NextResponse, type NextRequest } from 'next/server';
import { getCallerProfile } from '@/lib/auth/get-user';

// GET /api/auth/me → verify session + return permission flags
// Called client-side on dashboard mount to establish a verified permission state.
export async function GET(request: NextRequest) {
  const caller = await getCallerProfile(request);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    userId:          caller.userId,
    isAdmin:         caller.isAdmin,
    canEdit:         caller.canEdit,
    canViewFeedback: caller.canViewFeedback,
  });
}

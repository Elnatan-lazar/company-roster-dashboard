import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const { email, token } = await request.json();

  console.log('[API-OTP] Incoming request for email:', email);

  if (!email || !token) {
    console.log('[API-OTP] Missing email or token — returning 400');
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });

  console.log('[API-OTP] Supabase output - session exists:', !!data.session, 'error:', error?.message);

  if (error || !data.session) {
    console.log('[API-OTP] Verification failed — returning 401');
    return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 401 });
  }

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');

  const cookieName  = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify(data.session);

  console.log('[API-OTP] Attempting to set cookie:', cookieName, 'Value preview:', cookieValue.substring(0, 30));

  const response = NextResponse.json({ success: true });

  response.cookies.set(cookieName, cookieValue, {
    path:     '/',
    sameSite: 'lax',
    httpOnly: true,
    secure:   true,
    maxAge:   data.session.expires_in ?? 3600,
  });

  console.log('[API-OTP] Cookie set successfully — returning 200');

  return response;
}

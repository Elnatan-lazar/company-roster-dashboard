import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const { email, token } = await request.json();

  if (!email || !token) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Use plain supabase-js (no SSR wrapper) to verify the OTP and get the session
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

  console.log('[verify-otp] user:', data?.user?.email, '| error:', error?.message);

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 401 });
  }

  // Extract the Supabase project ref from the URL to build the cookie name
  // e.g. https://abcdef.supabase.co → abcdef
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');

  const cookieName  = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify(data.session);

  console.log('[verify-otp] setting cookie:', cookieName, 'length:', cookieValue.length);

  const response = NextResponse.json({ success: true });

  response.cookies.set(cookieName, cookieValue, {
    path:     '/',
    sameSite: 'lax',
    httpOnly: true,
    secure:   true,
    maxAge:   data.session.expires_in ?? 3600,
  });

  return response;
}

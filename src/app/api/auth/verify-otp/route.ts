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
  // Store only token fields — omitting the large `user` object keeps the cookie
  // well under the 4 KB browser limit (full session with Google metadata can exceed it).
  const compactSession = {
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
    expires_at:    data.session.expires_at,
    token_type:    data.session.token_type,
  };
  const cookieValue = JSON.stringify(compactSession);

  console.log('[verify-otp] setting cookie:', cookieName, 'length:', cookieValue.length);

  const response = NextResponse.json({ success: true });

  response.cookies.set(cookieName, cookieValue, {
    path:     '/',
    sameSite: 'lax',
    httpOnly: false,
    secure:   false,   // localhost — no HTTPS
    maxAge:   data.session.expires_in ?? 3600,
  });

  return response;
}

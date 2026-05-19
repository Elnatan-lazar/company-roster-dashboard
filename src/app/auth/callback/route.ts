import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /auth/callback
// Supabase redirects here after Google OAuth with ?code=...
// We exchange the code for a session and write our custom JSON cookie,
// exactly matching the format set by verify-otp so the rest of the app
// (getCallerProfile, getAuthenticatedUser) can read it.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  // Exchange the auth code for a session using a plain supabase-js client
  // (no SSR wrapper — same pattern as verify-otp)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    console.error('[auth/callback] exchange error:', exchangeError?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }

  // Derive the cookie name the same way as verify-otp and get-user
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');

  const cookieName  = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify(data.session);

  const response = NextResponse.redirect(`${origin}/dashboard`);

  response.cookies.set(cookieName, cookieValue, {
    path:     '/',
    sameSite: 'lax',
    httpOnly: false,
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   data.session.expires_in ?? 3600,
  });

  return response;
}

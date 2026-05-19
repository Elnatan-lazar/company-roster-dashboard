import { NextResponse } from 'next/server';

function getProjectRef(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');
}

// POST /api/auth/signout
// Clears the custom session cookie and redirects to login.
export async function POST() {
  const cookieName = `sb-${getProjectRef()}-auth-token`;
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const response = NextResponse.redirect(new URL('/auth/login', siteUrl));
  // Expire the session cookie immediately
  response.cookies.set(cookieName, '', {
    path:     '/',
    maxAge:   0,
    sameSite: 'lax',
    httpOnly: false,
  });
  return response;
}

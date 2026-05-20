import { NextResponse, type NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PREFIXES = [
  '/auth/login',
  '/auth/callback',
  '/auth/error',
  '/api/auth/check-whitelist',
  '/api/auth/verify-otp',
  '/api/auth/me',
];

function getProjectRef(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');
}

// Decode the JWT payload WITHOUT verifying the signature so we can read the
// `exp` claim with zero network latency. The actual cryptographic validation
// happens in every API route via getCallerProfile (admin client).
function jwtIsValid(jwt: string): boolean {
  try {
    const base64 = jwt.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    // `atob` is available in both Node.js 18+ and edge runtime
    const payload = JSON.parse(atob(base64));
    // exp is seconds since epoch
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));

  console.log('[MIDDLEWARE] Path:', pathname, '| isPublic:', isPublic);

  const cookieName = `sb-${getProjectRef()}-auth-token`;
  const rawCookie  = request.cookies.get(cookieName)?.value;

  console.log('[MIDDLEWARE] Looking for cookie:', cookieName);
  console.log('[MIDDLEWARE] Raw cookie found:', !!rawCookie, '| Length:', rawCookie?.length ?? 0);

  let authenticated = false;

  if (rawCookie) {
    try {
      const session = JSON.parse(rawCookie);
      console.log('[MIDDLEWARE] Parsed session valid token:', !!session?.access_token);
      if (session?.access_token) {
        authenticated = jwtIsValid(session.access_token);
      }
    } catch (err) {
      console.log('[MIDDLEWARE] Cookie parsing FAILED with error:', err);
    }
  }

  console.log('[MIDDLEWARE] Route allowed status:', authenticated);

  // Unauthenticated request to a protected route → login
  if (!authenticated && !isPublic) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting the login page → dashboard
  if (authenticated && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next({ request: { headers: request.headers } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
};

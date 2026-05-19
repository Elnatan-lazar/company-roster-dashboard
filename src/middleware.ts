import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/callback',
  '/auth/error',
  '/api/auth/check-whitelist',
  '/api/auth/verify-otp',
];

// Extract project ref from Supabase URL
// e.g. https://abcdef.supabase.co → abcdef
function getProjectRef(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const pathname  = request.nextUrl.pathname;
  const isPublic  = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Read the session cookie directly and pass the JWT to getUser()
  // This bypasses the @supabase/ssr storage adapter which has issues reading
  // sessions set by our API route in some versions
  const cookieName = `sb-${getProjectRef()}-auth-token`;
  const rawCookie  = request.cookies.get(cookieName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null;

  if (rawCookie?.value) {
    try {
      const session = JSON.parse(rawCookie.value);
      if (session?.access_token) {
        // Pass JWT directly — skips internal storage, validates with Supabase servers
        const { data } = await supabase.auth.getUser(session.access_token);
        user = data.user ?? null;
      }
    } catch {
      // Malformed cookie — user stays null
    }
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
};

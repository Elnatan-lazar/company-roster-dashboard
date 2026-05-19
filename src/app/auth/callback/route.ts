import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// GET /auth/callback
// Supabase redirects here after Google OAuth with ?code=...
//
// Critical: the PKCE code verifier was stored in a cookie by createBrowserClient
// when signInWithOAuth was called. We MUST use @supabase/ssr's createServerClient
// (with cookie adapters) so it can read that verifier and complete the exchange.
// A plain supabase-js client has no cookie access and will always fail PKCE exchange.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('[auth/callback] OAuth error from provider:', error);
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('[auth/callback] No code in request — check Supabase Redirect URLs allowlist');
    return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
  }

  // Build the final redirect response NOW so we can attach cookies to it.
  // (NextResponse.redirect creates the response object; cookies are added below.)
  const response = NextResponse.redirect(`${origin}/dashboard`);

  // Create a server-side Supabase client backed by this request's cookies.
  // This gives exchangeCodeForSession access to the PKCE verifier cookie
  // (sb-{ref}-auth-code-verifier) that was set by createBrowserClient.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write any new/updated cookies (@supabase/ssr sets several) onto
          // the redirect response so the browser receives them.
          cookiesToSet.forEach(({ name, value, options }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.cookies.set(name, value, options as any);
          });
        },
      },
    },
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.session) {
    console.error('[auth/callback] exchangeCodeForSession failed:', exchangeError?.message);
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }

  // Write our custom JSON session cookie so getCallerProfile() and
  // getAuthenticatedUser() (which parse it manually) can read the session.
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');

  // Compact session — omit large `user` object to stay under 4 KB cookie limit.
  const compactSession = {
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in:    data.session.expires_in,
    expires_at:    data.session.expires_at,
    token_type:    data.session.token_type,
  };

  response.cookies.set(
    `sb-${projectRef}-auth-token`,
    JSON.stringify(compactSession),
    {
      path:     '/',
      sameSite: 'lax',
      httpOnly: false,
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   data.session.expires_in ?? 3600,
    },
  );

  return response;
}

import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserRow } from '@/types/database';
import type { Database } from '@/types/database';

function getProjectRef(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace(/https?:\/\//, '')
    .replace(/\.supabase\.co.*/, '');
}

// Creates a Supabase client authenticated with the access_token from the cookie
// This is needed because @supabase/ssr's cookie storage doesn't work with our
// manually-set session cookie
function createAuthedClient(accessToken: string) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies:  { getAll: () => [], setAll: () => {} },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    }
  );
}

// Reads and validates the session from the cookie
async function getSessionAndUser() {
  const cookieStore = cookies();
  const rawCookie   = cookieStore.get(`sb-${getProjectRef()}-auth-token`);
  if (!rawCookie?.value) return null;

  try {
    const session = JSON.parse(rawCookie.value);
    if (!session?.access_token) return null;

    const supabase = createAuthedClient(session.access_token);
    const { data }  = await supabase.auth.getUser(session.access_token);
    if (!data.user) return null;

    return { user: data.user, accessToken: session.access_token };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<UserRow> {
  const auth = await getSessionAndUser();

  if (!auth) {
    redirect('/auth/login');
  }

  // Use admin client to bypass RLS recursion issue in users policy
  const adminClient = createAdminClient();

  const { data: profile, error } = await adminClient
    .from('users')
    .select('*')
    .eq('id', auth!.user.id)
    .single();

  if (error || !profile) {
    console.log('[getAuthenticatedUser] profile error:', error?.message, error?.code);
    redirect('/auth/error');
  }

  return profile!;
}

export async function requireRole(
  allowedRoles: UserRow['role'][]
): Promise<UserRow> {
  const user = await getAuthenticatedUser();
  if (!allowedRoles.includes(user.role)) redirect('/dashboard');
  return user;
}

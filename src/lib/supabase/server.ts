import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// Server-side Supabase client (for Server Components and Route Handlers)
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options as any);
            });
          } catch {
            // Called from Server Component — middleware handles refresh
          }
        },
      },
    }
  );
}

// Admin client — uses service_role key, bypasses RLS
// Returns `any` intentionally: the Database generic doesn't fully cover all tables
// (leave_requests, company_settings, etc.), so strict typing would produce `never`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): any {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

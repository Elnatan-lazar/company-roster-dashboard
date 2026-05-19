import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { ROLE_LABELS } from '@/types/database';

// Dashboard layout — server component, always authenticated
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navigation bar — mobile first */}
      <header className="bg-olive-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🛡️</span>
            <div>
              <h1 className="font-bold text-base leading-tight">ניהול פלוגה</h1>
              <p className="text-olive-200 text-xs">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm hidden sm:block">
              {user.first_name} {user.last_name}
            </span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-olive-200 hover:text-white text-sm transition-colors"
              >
                יציאה
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

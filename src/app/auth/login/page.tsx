'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginForm() {
  const supabase = createClient();

  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [step,        setStep]        = useState<'email' | 'otp'>('email');
  const [loading,     setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Google OAuth
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });
    if (oauthError || !data.url) {
      setError('שגיאה בחיבור לגוגל. נסה שנית.');
      setGoogleLoading(false);
      return;
    }
    window.location.href = data.url;
  }

  // Step 1 — check whitelist then send OTP code
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    const checkRes = await fetch('/api/auth/check-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (!checkRes.ok) {
      const body = await checkRes.json().catch(() => ({}));
      setError(body.error ?? 'האימייל אינו מופיע ברשימת הסד"כ הפלוגתית, אנא פנה לסגל הפיקוד.');
      setLoading(false);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });

    if (otpError) {
      console.error('OTP send error:', otpError.message);
      setError('שגיאה בשליחת הקוד. נסה שנית.');
    } else {
      setStep('otp');
    }

    setLoading(false);
  }

  // Step 2 — verify via server-side API route so session cookie is set by the server
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), token: otp.trim() }),
    });

    if (!res.ok) {
      setError('הקוד שגוי או שפג תוקפו. בקש קוד חדש.');
      setLoading(false);
      return;
    }

    // Session is now set server-side — navigate to dashboard
    window.location.href = '/dashboard';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-olive-800 to-olive-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-olive-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold text-olive-800">מערכת ניהול פלוגה</h1>
          <p className="text-gray-500 mt-1 text-sm">יחידת שריון</p>
        </div>

        {step === 'email' ? (
          <div className="space-y-5">

            {/* Google OAuth button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 font-semibold py-3 rounded-lg transition-all shadow-sm"
            >
              {googleLoading ? (
                <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <GoogleIcon />
              )}
              {googleLoading ? 'מעביר לגוגל...' : 'כניסה עם Google'}
            </button>

            {/* Divider */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium shrink-0">או כניסה עם אימייל</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email OTP form */}
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  כתובת מייל
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-500 text-left"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-olive-700 hover:bg-olive-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'שולח...' : 'שלח קוד כניסה'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400">
              הכניסה מוגבלת לאנשי הפלוגה המורשים בלבד.
            </p>
          </div>

        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="text-center mb-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✉️</span>
              </div>
              <p className="text-gray-600 text-sm">
                שלחנו קוד 6 ספרות אל<br/>
                <strong>{email}</strong>
              </p>
            </div>

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                קוד אימות
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                dir="ltr"
                placeholder="12345678"
                maxLength={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-olive-500 text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-olive-700 hover:bg-olive-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'מאמת...' : 'כניסה למערכת'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setOtp(''); setError(null); }}
              className="w-full text-gray-500 text-sm hover:text-gray-700"
            >
              שלח קוד מחדש
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-olive-700" />}>
      <LoginForm />
    </Suspense>
  );
}

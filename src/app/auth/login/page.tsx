'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const supabase = createClient();

  const [email, setEmail]   = useState('');
  const [otp, setOtp]       = useState('');
  const [step, setStep]     = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

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
          <form onSubmit={handleSendOtp} className="space-y-5">
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

            <p className="text-center text-xs text-gray-400">
              הכניסה מוגבלת לאנשי הפלוגה המורשים בלבד.
            </p>
          </form>

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

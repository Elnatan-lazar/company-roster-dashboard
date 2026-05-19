// Authentication error page — displayed when magic link is invalid or expired
export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-olive-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">שגיאת כניסה</h1>
        <p className="text-gray-600 mb-6">
          קישור הכניסה אינו תקף או שפג תוקפו.
          <br />
          אנא נסה שוב.
        </p>
        <a
          href="/auth/login"
          className="inline-block bg-olive-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-olive-800 transition-colors"
        >
          חזרה לכניסה
        </a>
      </div>
    </div>
  );
}

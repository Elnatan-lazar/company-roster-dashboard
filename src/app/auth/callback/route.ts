import { NextResponse, type NextRequest } from 'next/server';

// Fallback handler — OTP login does not use this route.
// Any stray ?code= landing here is sent back to login.
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/login`);
}

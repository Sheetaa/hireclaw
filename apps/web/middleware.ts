import { NextRequest, NextResponse } from 'next/server';

const STAGING_HOST = 'staging.hireclaw.bot';
const COOKIE_NAME = '_stk_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  if (host !== STAGING_HOST) {
    return NextResponse.next();
  }

  const token = process.env.STAGING_TOKEN;

  // Fail closed
  if (!token) {
    return new NextResponse('Staging token not configured', {
      status: 500,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  // Check for magic link token in URL
  const url = request.nextUrl;
  const paramToken = url.searchParams.get('_stk');

  if (paramToken === token) {
    // Strip token from URL and set cookie
    url.searchParams.delete('_stk');
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  // Check cookie
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;

  if (cookieToken === token) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  // Unauthorized
  return new NextResponse('Not authorized. Use your magic link to access staging.', {
    status: 403,
    headers: { 'X-Robots-Tag': 'noindex, nofollow' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

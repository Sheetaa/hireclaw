import { NextRequest, NextResponse } from 'next/server';

const STAGING_HOST = 'staging.hireclaw.bot';

function unauthorizedResponse() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Staging"',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
    },
  });
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';

  // Only protect staging domain
  if (host !== STAGING_HOST) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  const username = process.env.STAGING_USER;
  const password = process.env.STAGING_PASS;

  // Fail closed if secrets are missing
  if (!username || !password) {
    return new NextResponse('Staging credentials are not configured', {
      status: 500,
      headers: {
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
      },
    });
  }

  if (!authHeader?.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  const token = authHeader.slice(6).trim();
  const decoded = Buffer.from(token, 'base64').toString('utf-8');
  const [inputUser, inputPass] = decoded.split(':');

  if (inputUser !== username || inputPass !== password) {
    return unauthorizedResponse();
  }

  const response = NextResponse.next();
  response.headers.set(
    'X-Robots-Tag',
    'noindex, nofollow, noarchive, nosnippet, noimageindex',
  );
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

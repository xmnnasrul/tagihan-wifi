import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME } from './lib/auth-constants';
import { createSecurityHeaders } from './lib/security-headers';

const publicPaths = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const isProduction = process.env.NODE_ENV === 'production';
  const securityHeaders = createSecurityHeaders(nonce, isProduction);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', securityHeaders['Content-Security-Policy']);
  requestHeaders.set('x-nonce', nonce);

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isPublicPath = pathname.startsWith('/api') || publicPaths.includes(pathname);
  const response = !isPublicPath && !token
    ? NextResponse.redirect(new URL('/login', request.url))
    : NextResponse.next({ request: { headers: requestHeaders } });

  Object.entries(securityHeaders).forEach(([name, value]) => response.headers.set(name, value));

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

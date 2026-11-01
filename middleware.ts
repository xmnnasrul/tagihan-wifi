import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose/jwt/verify';
import { COOKIE_NAME } from './lib/auth-constants';
import { createSecurityHeaders } from './lib/security-headers';

const publicPaths = new Set(['/login', '/api/auth/login', '/api/auth/logout']);

async function hasValidSession(token?: string): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.JWT_SECRET
    || (process.env.NODE_ENV === 'production' ? '' : 'wifi-billing-secret-change-in-development');
  if (!secret) return false;

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const isProduction = process.env.NODE_ENV === 'production';
  const securityHeaders = createSecurityHeaders(nonce, isProduction);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', securityHeaders['Content-Security-Policy']);
  requestHeaders.set('x-nonce', nonce);

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const isPublicPath = publicPaths.has(pathname);
  const isApiPath = pathname === '/api' || pathname.startsWith('/api/');
  const isAuthenticated = isPublicPath || await hasValidSession(token);
  const response = isAuthenticated
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : isApiPath
      ? NextResponse.json({ error: 'Autentikasi diperlukan' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));

  if (!isAuthenticated && token) response.cookies.delete(COOKIE_NAME);

  Object.entries(securityHeaders).forEach(([name, value]) => response.headers.set(name, value));

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

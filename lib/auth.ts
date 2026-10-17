import jwt from 'jsonwebtoken';
import type { UserRole } from '@/lib/roles';
import { COOKIE_NAME } from './auth-constants';

export { COOKIE_NAME };

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET harus dikonfigurasi di production');
  }
  return 'wifi-billing-secret-change-in-development';
}
export interface TokenPayload {
  username: string;
  role: string;
  roles?: UserRole[];
  tokenVersion?: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function signSocketTicket(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, purpose: 'socket-ticket' },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      audience: 'wifi-billing-socket',
      expiresIn: '15m',
    }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

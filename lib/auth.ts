import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET harus dikonfigurasi di production');
  }
  return 'wifi-billing-secret-change-in-development';
}
const COOKIE_NAME = 'auth_token';

export interface TokenPayload {
  username: string;
  role: string;
  tokenVersion?: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };

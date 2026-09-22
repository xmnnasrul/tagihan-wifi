import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'wifi-billing-secret-change-in-production';
const COOKIE_NAME = 'auth_token';

export interface TokenPayload {
  username: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export { JWT_SECRET, COOKIE_NAME };

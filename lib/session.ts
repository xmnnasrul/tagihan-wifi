import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME, TokenPayload } from './auth';

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

import { UNKNOWN_CLIENT_IP } from './client-ip.ts';

export const IP_RATE_LIMIT = 30;
export const ACCOUNT_IP_RATE_LIMIT = 5;
export const ACCOUNT_RATE_LIMIT = 10;

export interface RateLimitRule {
  scope: string;
  limit: number;
}

/**
 * Menentukan keranjang rate limit untuk percobaan login.
 * Jika IP klien tidak diketahui, keranjang IP global dilewati agar satu
 * pengguna tanpa header IP tidak bisa memblokir semua pengguna lain.
 */
export function getRateLimitRules(clientIp: string, username: string): RateLimitRule[] {
  const account = username.trim().toLowerCase();

  if (clientIp === UNKNOWN_CLIENT_IP) {
    return [{ scope: `account:${account}`, limit: ACCOUNT_RATE_LIMIT }];
  }

  return [
    { scope: `ip:${clientIp}`, limit: IP_RATE_LIMIT },
    { scope: `account-ip:${clientIp}:${account}`, limit: ACCOUNT_IP_RATE_LIMIT },
  ];
}

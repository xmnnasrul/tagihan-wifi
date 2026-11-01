import { createHmac } from 'node:crypto';
import LoginRateLimit from '@/lib/models/LoginRateLimit';

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_IP_LIMIT = 5;
const IP_LIMIT = 30;

interface RateLimitKey {
  key: string;
  limit: number;
}

let indexesPromise: Promise<void> | null = null;

function hashKey(value: string): string {
  const secret = process.env.JWT_SECRET || 'wifi-billing-secret-change-in-development';
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function getLoginRateLimitKeys(request: Request, username: string): RateLimitKey[] {
  const clientIp = request.headers.get('x-nf-client-connection-ip')?.trim() || 'unknown';

  return [
    { key: hashKey(`ip:${clientIp}`), limit: IP_LIMIT },
    { key: hashKey(`account-ip:${clientIp}:${username}`), limit: ACCOUNT_IP_LIMIT },
  ];
}

async function ensureRateLimitIndexes(): Promise<void> {
  if (!indexesPromise) {
    const pending = LoginRateLimit.createIndexes().then(() => undefined);
    indexesPromise = pending;
    void pending.catch(() => {
      if (indexesPromise === pending) indexesPromise = null;
    });
  }

  await indexesPromise;
}

async function consumeRateLimitKey(key: string, limit: number, now: Date) {
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  const shouldReset = {
    $or: [
      { $eq: [{ $type: '$windowStartedAt' }, 'missing'] },
      { $lte: ['$windowStartedAt', cutoff] },
    ],
  };

  await LoginRateLimit.updateOne({ key }, [{
    $set: {
      count: {
        $cond: [shouldReset, 1, { $add: [{ $ifNull: ['$count', 0] }, 1] }],
      },
      windowStartedAt: { $cond: [shouldReset, now, '$windowStartedAt'] },
      expiresAt: { $cond: [shouldReset, expiresAt, '$expiresAt'] },
    },
  }], { upsert: true });

  const record = await LoginRateLimit.findOne({ key }).select('count windowStartedAt').lean();
  if (!record) throw new Error('Login rate limit record was not created');

  return {
    limited: record.count > limit,
    retryAfter: Math.max(1, Math.ceil((record.windowStartedAt.getTime() + WINDOW_MS - now.getTime()) / 1000)),
  };
}

export async function checkLoginRateLimit(keys: RateLimitKey[], now = new Date()) {
  await ensureRateLimitIndexes();
  const results = await Promise.all(keys.map(({ key, limit }) => consumeRateLimitKey(key, limit, now)));
  const blockedResults = results.filter((result) => result.limited);

  return {
    limited: blockedResults.length > 0,
    retryAfter: Math.max(0, ...blockedResults.map((result) => result.retryAfter)),
  };
}

export async function clearLoginRateLimit(keys: RateLimitKey[]): Promise<void> {
  await LoginRateLimit.deleteMany({ key: { $in: keys.map(({ key }) => key) } });
}
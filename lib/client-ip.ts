import { isIP } from 'node:net';

export const UNKNOWN_CLIENT_IP = 'unknown';

const IP_HEADERS = [
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
  'x-nf-client-connection-ip',
  'true-client-ip',
];

function normalizeIp(value: string | null): string | null {
  if (!value) return null;

  const candidate = value.split(',')[0].trim();
  if (!candidate) return null;
  if (isIP(candidate)) return candidate;

  if (candidate.startsWith('[')) {
    const closingBracket = candidate.indexOf(']');
    if (closingBracket > 0) {
      const inner = candidate.slice(1, closingBracket);
      if (isIP(inner)) return inner;
    }
  }

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1])) return ipv4WithPort[1];

  return null;
}

export function getClientIp(request: Request): string {
  const configuredHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const headers = configuredHeader ? [configuredHeader] : IP_HEADERS;

  for (const header of headers) {
    const ip = normalizeIp(request.headers.get(header));
    if (ip) return ip;
  }

  return UNKNOWN_CLIENT_IP;
}

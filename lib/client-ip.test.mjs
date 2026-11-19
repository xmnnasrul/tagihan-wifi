import test from 'node:test';
import assert from 'node:assert/strict';

import { getClientIp, UNKNOWN_CLIENT_IP } from './client-ip.ts';

function requestWith(headers) {
  return new Request('http://localhost/api/auth/login', { headers });
}

test('uses the first x-forwarded-for address', () => {
  const request = requestWith({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2' });
  assert.equal(getClientIp(request), '203.0.113.7');
});

test('reads other common proxy headers', () => {
  assert.equal(getClientIp(requestWith({ 'x-real-ip': '198.51.100.9' })), '198.51.100.9');
  assert.equal(getClientIp(requestWith({ 'cf-connecting-ip': '198.51.100.10' })), '198.51.100.10');
  assert.equal(getClientIp(requestWith({ 'x-nf-client-connection-ip': '198.51.100.11' })), '198.51.100.11');
});

test('strips ports and IPv6 brackets', () => {
  assert.equal(getClientIp(requestWith({ 'x-forwarded-for': '203.0.113.7:443' })), '203.0.113.7');
  assert.equal(getClientIp(requestWith({ 'x-forwarded-for': '[2001:db8::1]:443' })), '2001:db8::1');
  assert.equal(getClientIp(requestWith({ 'x-forwarded-for': '2001:db8::1' })), '2001:db8::1');
});

test('falls back to unknown for missing or invalid values', () => {
  assert.equal(getClientIp(requestWith({})), UNKNOWN_CLIENT_IP);
  assert.equal(getClientIp(requestWith({ 'x-forwarded-for': 'not-an-ip' })), UNKNOWN_CLIENT_IP);
});

test('honors a configured header name', () => {
  process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';
  try {
    const request = requestWith({
      'x-forwarded-for': '203.0.113.7',
      'cf-connecting-ip': '198.51.100.20',
    });
    assert.equal(getClientIp(request), '198.51.100.20');
  } finally {
    delete process.env.CLIENT_IP_HEADER;
  }
});

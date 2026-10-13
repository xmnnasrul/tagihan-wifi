import assert from 'node:assert/strict';
import test from 'node:test';
import { createSecurityHeaders } from './security-headers.ts';

test('security headers include browser protections in every environment', () => {
  const headers = createSecurityHeaders('test-nonce', false);

  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
  assert.match(headers['Content-Security-Policy'], /script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/);
  assert.match(headers['Content-Security-Policy'], /ws: wss:/);
  assert.doesNotMatch(headers['Content-Security-Policy'], /upgrade-insecure-requests/);
  assert.equal(headers['Strict-Transport-Security'], undefined);
});

test('production CSP removes development allowances and enables HSTS', () => {
  const headers = createSecurityHeaders('production-nonce', true);
  const csp = headers['Content-Security-Policy'];

  assert.match(csp, /script-src 'self' 'nonce-production-nonce' 'strict-dynamic'/);
  assert.doesNotMatch(csp, /unsafe-eval|ws:|wss:/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.equal(headers['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
});
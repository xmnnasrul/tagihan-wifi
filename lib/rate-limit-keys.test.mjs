import test from 'node:test';
import assert from 'node:assert/strict';

import { UNKNOWN_CLIENT_IP } from './client-ip.ts';
import {
  ACCOUNT_IP_RATE_LIMIT,
  ACCOUNT_RATE_LIMIT,
  IP_RATE_LIMIT,
  getRateLimitRules,
} from './rate-limit-keys.ts';

test('known IP uses an IP bucket and an account+IP bucket', () => {
  const rules = getRateLimitRules('203.0.113.7', 'admin');

  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0], { scope: 'ip:203.0.113.7', limit: IP_RATE_LIMIT });
  assert.deepEqual(rules[1], { scope: 'account-ip:203.0.113.7:admin', limit: ACCOUNT_IP_RATE_LIMIT });
});

test('unknown IP skips the shared IP bucket', () => {
  const rules = getRateLimitRules(UNKNOWN_CLIENT_IP, 'admin');

  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0], { scope: 'account:admin', limit: ACCOUNT_RATE_LIMIT });
});

test('unknown IP keeps separate buckets per username', () => {
  const first = getRateLimitRules(UNKNOWN_CLIENT_IP, 'admin')[0].scope;
  const second = getRateLimitRules(UNKNOWN_CLIENT_IP, 'superadmin')[0].scope;

  assert.notEqual(first, second);
});

test('usernames are normalized before becoming a bucket key', () => {
  const rules = getRateLimitRules('203.0.113.7', '  Admin ');

  assert.equal(rules[1].scope, 'account-ip:203.0.113.7:admin');
});

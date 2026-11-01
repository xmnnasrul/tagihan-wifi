import assert from 'node:assert/strict';
import test from 'node:test';
import { loginSchema } from './login-validation.ts';

test('login schema normalizes valid usernames and preserves passwords', () => {
  assert.deepEqual(loginSchema.parse({ username: '  Admin_01 ', password: 'pass' }), {
    username: 'admin_01',
    password: 'pass',
  });
});

test('login schema rejects NoSQL-shaped credentials and unexpected fields', () => {
  assert.equal(loginSchema.safeParse({ username: { $ne: null }, password: 'pass' }).success, false);
  assert.equal(loginSchema.safeParse({ username: 'admin', password: 'pass', role: 'superadmin' }).success, false);
});

test('login schema rejects usernames outside the account policy and passwords over bcrypt limit', () => {
  assert.equal(loginSchema.safeParse({ username: 'x', password: 'pass' }).success, false);
  assert.equal(loginSchema.safeParse({ username: 'admin', password: 'é'.repeat(37) }).success, false);
});
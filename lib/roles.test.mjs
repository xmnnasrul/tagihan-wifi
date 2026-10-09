import test from 'node:test';
import assert from 'node:assert/strict';

import { getPrimaryRole, normalizeUserRoles } from './roles.ts';

test('keeps existing single-role accounts compatible', () => {
  assert.deepEqual(normalizeUserRoles('admin', []), ['admin']);
  assert.deepEqual(normalizeUserRoles('user', []), ['user']);
});

test('supports a combined admin and collector account', () => {
  const roles = normalizeUserRoles('admin', ['admin', 'collector']);

  assert.deepEqual(roles, ['admin', 'collector']);
  assert.equal(getPrimaryRole(roles), 'admin');
});

test('does not combine read-only user with privileged roles', () => {
  assert.deepEqual(normalizeUserRoles('user', ['user', 'collector']), ['collector']);
});
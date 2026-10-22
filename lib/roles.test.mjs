import test from 'node:test';
import assert from 'node:assert/strict';

import { canAccessApi, getPrimaryRole, hasAnyRole, normalizeUserRoles } from './roles.ts';

test('normalizes the supported admin and superadmin roles', () => {
  assert.deepEqual(normalizeUserRoles('admin', []), ['admin']);
  assert.deepEqual(normalizeUserRoles('superadmin', []), ['superadmin']);
  assert.equal(getPrimaryRole(['admin', 'superadmin']), 'superadmin');
});

test('consolidates legacy collector accounts into admin and rejects legacy user accounts', () => {
  assert.deepEqual(normalizeUserRoles('collector', []), ['admin']);
  assert.deepEqual(normalizeUserRoles('user', ['user', 'collector']), ['admin']);
  assert.deepEqual(normalizeUserRoles('user', []), []);
  assert.deepEqual(normalizeUserRoles('user', ['user']), []);
});

test('only admin and superadmin roles pass application access checks', () => {
  const noRoles = [];
  const adminRoles = normalizeUserRoles('admin', []);
  const superadminRoles = normalizeUserRoles('superadmin', []);

  assert.equal(hasAnyRole(noRoles, ['admin', 'superadmin']), false);
  assert.equal(hasAnyRole(adminRoles, ['admin']), true);
  assert.equal(hasAnyRole(adminRoles, ['superadmin']), false);
  assert.equal(hasAnyRole(superadminRoles, ['superadmin']), true);
  assert.equal(canAccessApi(false, adminRoles, ['admin']), false);
  assert.equal(canAccessApi(true, noRoles), false);
  assert.equal(canAccessApi(true, adminRoles, ['admin', 'superadmin']), true);
  assert.equal(canAccessApi(true, superadminRoles, ['superadmin']), true);
});

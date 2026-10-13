import test from 'node:test';
import assert from 'node:assert/strict';

import { canAccessApi, getPrimaryRole, hasAnyRole, normalizeUserRoles } from './roles.ts';

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

test('enforces authenticated role access for user, collector, admin, and combined roles', () => {
  const userRoles = normalizeUserRoles('user', []);
  const collectorRoles = normalizeUserRoles('collector', []);
  const adminRoles = normalizeUserRoles('admin', []);
  const combinedRoles = normalizeUserRoles('admin', ['admin', 'collector']);

  assert.equal(hasAnyRole(userRoles, ['admin']), false);
  assert.equal(hasAnyRole(userRoles, ['collector', 'admin']), false);
  assert.equal(hasAnyRole(collectorRoles, ['collector', 'admin']), true);
  assert.equal(hasAnyRole(collectorRoles, ['admin']), false);
  assert.equal(hasAnyRole(adminRoles, ['collector', 'admin']), true);
  assert.equal(hasAnyRole(combinedRoles, ['collector']), true);
  assert.equal(hasAnyRole(combinedRoles, ['admin']), true);
  assert.equal(hasAnyRole([], ['collector', 'admin']), false);
  assert.equal(canAccessApi(false, adminRoles, ['admin']), false);
  assert.equal(canAccessApi(true, userRoles), true);
  assert.equal(canAccessApi(true, userRoles, ['admin']), false);
  assert.equal(canAccessApi(true, collectorRoles, ['collector', 'admin']), true);
  assert.equal(canAccessApi(true, collectorRoles, ['admin']), false);
  assert.equal(canAccessApi(true, adminRoles, ['collector', 'admin']), true);
  assert.equal(canAccessApi(true, combinedRoles, ['collector']), true);
});
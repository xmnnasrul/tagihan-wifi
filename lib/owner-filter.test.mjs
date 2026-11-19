import test from 'node:test';
import assert from 'node:assert/strict';

import { getOwnerFilter } from './owner-filter.ts';

test('superadmin gets an empty filter and sees every owner', () => {
  assert.deepEqual(getOwnerFilter({ ownerId: 'owner-1', isSuperadmin: true }), {});
});

test('admin gets a filter scoped to their own ownerId', () => {
  assert.deepEqual(getOwnerFilter({ ownerId: 'owner-1', isSuperadmin: false }), { ownerId: 'owner-1' });
});

test('filter passes the ownerId through untouched', () => {
  const ownerId = { toHexString: () => 'abc' };
  assert.equal(getOwnerFilter({ ownerId, isSuperadmin: false }).ownerId, ownerId);
});

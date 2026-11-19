import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBillingFilter, getVisibleCustomerFilter } from './billing-query.ts';

test('ignores empty filters and the "all" status', () => {
  assert.deepEqual(buildBillingFilter({}), {});
  assert.deepEqual(buildBillingFilter({ month: null, year: '', customerName: null, status: 'all' }), {});
});

test('builds month, year, and status filters', () => {
  assert.deepEqual(
    buildBillingFilter({ month: 'Oktober', year: '2026', status: 'Belum Bayar' }),
    { month: 'Oktober', year: 2026, status: 'Belum Bayar' },
  );
});

test('escapes customer name so it cannot inject regex', () => {
  const filter = buildBillingFilter({ customerName: 'Budi.*' });

  assert.deepEqual(filter.customerName, { $regex: 'Budi\\.\\*', $options: 'i' });
});

test('scopes visible customers to the owner and hides archived ones', () => {
  const filter = getVisibleCustomerFilter({ ownerId: 'owner-1', isSuperadmin: false });

  assert.deepEqual(filter, { ownerId: 'owner-1', status: { $ne: 'inactive' } });
});

test('superadmin visible-customer filter is not limited by owner', () => {
  const filter = getVisibleCustomerFilter({ ownerId: 'owner-1', isSuperadmin: true });

  assert.deepEqual(filter, { status: { $ne: 'inactive' } });
});

test('only includes an archived customer when asked explicitly with its id', () => {
  const scoped = { ownerId: 'owner-1', isSuperadmin: false };

  assert.deepEqual(
    getVisibleCustomerFilter(scoped, { customerId: 'cust-1', includeArchived: true }),
    { ownerId: 'owner-1', _id: 'cust-1', status: 'inactive' },
  );
  assert.deepEqual(
    getVisibleCustomerFilter(scoped, { customerId: 'cust-1' }),
    { ownerId: 'owner-1', _id: 'cust-1', status: { $ne: 'inactive' } },
  );
  assert.deepEqual(
    getVisibleCustomerFilter(scoped, { includeArchived: true }),
    { ownerId: 'owner-1', status: { $ne: 'inactive' } },
  );
});

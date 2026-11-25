import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArrearsView,
  formatArrearsPercent,
  getArrearsBuckets,
  sortArrearsCustomers,
} from './arrears-summary.ts';

function period(month, year, outstandingAmount, status = 'Belum Bayar', paidAmount = 0) {
  return {
    month,
    year,
    billedAmount: outstandingAmount + paidAmount,
    paidAmount,
    outstandingAmount,
    status,
  };
}

function customer(customerId, customerName, arrearsMonthCount, totalOutstanding, outstandingPeriods) {
  return { customerId, customerName, address: '', arrearsMonthCount, totalOutstanding, outstandingPeriods };
}

test('buckets customers by arrears age and splits outstanding into shares', () => {
  const customers = [
    customer('a', 'A', 1, 100_000, [period('Mei', 2026, 100_000)]),
    customer('b', 'B', 2, 200_000, [period('April', 2026, 200_000)]),
    customer('c', 'C', 3, 300_000, [period('Maret', 2026, 300_000)]),
    customer('d', 'D', 5, 400_000, [period('Januari', 2026, 400_000)]),
  ];

  assert.deepEqual(getArrearsBuckets(customers), [
    { key: '1', label: '1 bulan', customerCount: 1, totalOutstanding: 100_000, share: 0.1, percent: 10 },
    { key: '2', label: '2 bulan', customerCount: 1, totalOutstanding: 200_000, share: 0.2, percent: 20 },
    { key: '3+', label: '3+ bulan', customerCount: 2, totalOutstanding: 700_000, share: 0.7, percent: 70 },
  ]);
});

test('builds a view with per-period status filtering and recomputed totals', () => {
  const report = [
    {
      customerId: 'a',
      customerName: 'Ani',
      address: 'Jl. Melati',
      totalOutstanding: 150_000,
      outstandingPeriods: [
        period('Januari', 2026, 100_000),
        period('Februari', 2026, 50_000, 'Nyicil', 50_000),
      ],
    },
    {
      customerId: 'b',
      customerName: 'Budi',
      address: 'Jl. Mawar',
      totalOutstanding: 25_000,
      outstandingPeriods: [period('Januari', 2026, 25_000, 'Nyicil', 75_000)],
    },
    {
      customerId: 'c',
      customerName: 'Cici',
      address: 'Jl. Kenanga',
      totalOutstanding: 40_000,
      outstandingPeriods: [period('Januari', 2026, 40_000)],
    },
  ];

  const installmentView = buildArrearsView(report, { cutoff: null, status: 'Nyicil' });
  assert.deepEqual(installmentView.customers.map((item) => [
    item.customerId,
    item.totalOutstanding,
    item.outstandingPeriods.length,
    item.arrearsMonthCount,
  ]), [
    ['a', 50_000, 1, 1],
    ['b', 25_000, 1, 1],
  ]);
  assert.equal(installmentView.totalOutstanding, 75_000);
  assert.equal(installmentView.periodCount, 2);

  const januaryView = buildArrearsView(report, { cutoff: { month: 'Januari', year: 2026 }, status: 'all' });
  assert.deepEqual(januaryView.customers.map((item) => [item.customerId, item.totalOutstanding]), [
    ['a', 100_000],
    ['b', 25_000],
    ['c', 40_000],
  ]);
  assert.equal(januaryView.totalOutstanding, 165_000);
  assert.equal(januaryView.periodCount, 3);
});

test('drops customers without a period matching the filter', () => {
  const view = buildArrearsView([
    {
      customerId: 'a',
      customerName: 'Ani',
      address: '',
      totalOutstanding: 100_000,
      outstandingPeriods: [period('Januari', 2026, 100_000)],
    },
  ], { cutoff: null, status: 'Nyicil' });

  assert.deepEqual(view.customers, []);
  assert.equal(view.totalOutstanding, 0);
  assert.equal(view.periodCount, 0);
  assert.deepEqual(view.buckets.map((bucket) => bucket.customerCount), [0, 0, 0]);
});

test('rounds bucket percentages so they add up to 100', () => {
  const buckets = getArrearsBuckets([
    customer('a', 'A', 1, 100_000, [period('Mei', 2026, 100_000)]),
    customer('b', 'B', 2, 100_000, [period('April', 2026, 100_000)]),
    customer('c', 'C', 3, 100_000, [period('Maret', 2026, 100_000)]),
  ]);

  assert.deepEqual(buckets.map((bucket) => bucket.percent), [34, 33, 33]);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.percent, 0), 100);
});

test('labels a sub-one-percent share as <1%', () => {
  const buckets = getArrearsBuckets([
    customer('a', 'A', 1, 996_000, [period('Mei', 2026, 996_000)]),
    customer('b', 'B', 3, 4_000, [period('Maret', 2026, 4_000)]),
  ]);

  assert.equal(buckets[2].percent, 0);
  assert.ok(buckets[2].share > 0);
  assert.equal(formatArrearsPercent(buckets[2]), '<1%');
});

test('sorts by name with a numeric-aware collator', () => {
  const customers = [
    customer('10', 'Pelanggan 10', 1, 100_000, [period('Mei', 2026, 100_000)]),
    customer('2', 'Pelanggan 2', 1, 100_000, [period('Mei', 2026, 100_000)]),
    customer('ani', 'ani', 1, 100_000, [period('Mei', 2026, 100_000)]),
  ];

  assert.deepEqual(
    sortArrearsCustomers(customers, 'name', 'asc').map((item) => item.customerName),
    ['ani', 'Pelanggan 2', 'Pelanggan 10'],
  );
  assert.deepEqual(
    sortArrearsCustomers(customers, 'name', 'desc').map((item) => item.customerName),
    ['Pelanggan 10', 'Pelanggan 2', 'ani'],
  );
});

test('sorts by arrears age and by outstanding amount', () => {
  const customers = [
    customer('a', 'A', 2, 100_000, [period('April', 2026, 100_000)]),
    customer('b', 'B', 4, 50_000, [period('Januari', 2026, 50_000)]),
    customer('c', 'C', 1, 300_000, [period('Mei', 2026, 300_000)]),
  ];

  assert.deepEqual(
    sortArrearsCustomers(customers, 'age', 'asc').map((item) => item.customerId),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(
    sortArrearsCustomers(customers, 'age', 'desc').map((item) => item.customerId),
    ['b', 'a', 'c'],
  );
  assert.deepEqual(
    sortArrearsCustomers(customers, 'amount', 'desc').map((item) => item.customerId),
    ['c', 'a', 'b'],
  );
});

test('keeps the previous order for equal sort values', () => {
  const customers = [
    customer('a', 'A', 1, 100_000, [period('Mei', 2026, 100_000)]),
    customer('b', 'B', 1, 100_000, [period('Mei', 2026, 100_000)]),
    customer('c', 'C', 1, 50_000, [period('Mei', 2026, 50_000)]),
  ];

  assert.deepEqual(
    sortArrearsCustomers(customers, 'amount', 'desc').map((item) => item.customerId),
    ['a', 'b', 'c'],
  );
});

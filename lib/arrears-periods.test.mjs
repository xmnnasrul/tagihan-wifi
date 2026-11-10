import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPeriodsThroughMonth, getArrearsMonthCount } from './arrears-periods.ts';

test('October view includes outstanding periods from earlier months', () => {
  const periods = [
    { month: 'September', year: 2026 },
    { month: 'Oktober', year: 2026 },
    { month: 'November', year: 2026 },
  ];

  const throughOctober = filterPeriodsThroughMonth(periods, { month: 'Oktober', year: 2026 });

  assert.deepEqual(throughOctober, periods.slice(0, 2));
  assert.equal(getArrearsMonthCount(throughOctober, { month: 'Oktober', year: 2026 }), 2);
});

test('a September arrear is two months old in the October view', () => {
  const septemberArrear = [{ month: 'September', year: 2026 }];

  assert.equal(getArrearsMonthCount(septemberArrear, { month: 'Oktober', year: 2026 }), 2);
});

test('arrears age crosses the year boundary', () => {
  const decemberArrear = [{ month: 'Desember', year: 2026 }];

  assert.equal(getArrearsMonthCount(decemberArrear, { month: 'Januari', year: 2027 }), 2);
});

test('all months counts outstanding billing periods without an as-of cutoff', () => {
  const periods = [
    { month: 'September', year: 2026 },
    { month: 'Oktober', year: 2026 },
  ];

  assert.deepEqual(filterPeriodsThroughMonth(periods, null), periods);
  assert.equal(getArrearsMonthCount(periods, null), 2);
});
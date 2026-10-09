import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPaymentToPreviousBillings, getMonthlyBillingAmounts } from './billing-amounts.ts';

test('counts only the selected month amount, excluding carried arrears', () => {
  const monthlyAmounts = getMonthlyBillingAmounts({
    totalDue: 4500000,
    packagePrice: 1500000,
    carriedAmount: 3000000,
    paidAmount: 4500000,
    installmentAmount: 0,
    status: 'Lunas',
  });

  assert.deepEqual(monthlyAmounts, { due: 1500000, paid: 1500000, outstanding: 0 });
});

test('settles older unpaid billings before the current month when payment covers them', () => {
  const billings = [
    {
      month: 'Januari',
      year: 2026,
      totalDue: 100000,
      packagePrice: 100000,
      carriedAmount: 0,
      paidAmount: 0,
      installmentAmount: 0,
      status: 'Belum Bayar',
      paymentHistory: [],
    },
    {
      month: 'Februari',
      year: 2026,
      totalDue: 100000,
      packagePrice: 100000,
      carriedAmount: 0,
      paidAmount: 0,
      installmentAmount: 0,
      status: 'Belum Bayar',
      paymentHistory: [],
    },
  ];

  const result = applyPaymentToPreviousBillings(billings, 200000);

  assert.equal(result.remaining, 0);
  assert.equal(result.billings[0].status, 'Lunas');
  assert.equal(result.billings[1].status, 'Lunas');
  assert.equal(result.billings[0].paidAmount, 100000);
  assert.equal(result.billings[1].paidAmount, 100000);
  assert.equal(result.billings[0].paymentHistory[0].isSettlementAllocation, true);
  assert.equal(result.billings[1].paymentHistory[0].isSettlementAllocation, true);
});

test('partially settles the oldest unpaid bills and closes the first one immediately', () => {
  const billings = [
    {
      month: 'Januari',
      year: 2026,
      totalDue: 100000,
      packagePrice: 100000,
      carriedAmount: 0,
      paidAmount: 0,
      installmentAmount: 0,
      status: 'Belum Bayar',
      paymentHistory: [],
    },
    {
      month: 'Februari',
      year: 2026,
      totalDue: 100000,
      packagePrice: 100000,
      carriedAmount: 0,
      paidAmount: 0,
      installmentAmount: 0,
      status: 'Belum Bayar',
      paymentHistory: [],
    },
  ];

  const result = applyPaymentToPreviousBillings(billings, 150000);

  assert.equal(result.remaining, 0);
  assert.equal(result.billings[0].status, 'Lunas');
  assert.equal(result.billings[1].status, 'Nyicil');
  assert.equal(result.billings[1].paidAmount, 50000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMonthlyRecap } from './monthly-recap.ts';

test('summarizes monthly billings, distinct customers, payment methods, and unpaid balances', () => {
  const summaries = summarizeMonthlyRecap([
    {
      customerId: 'customer-1',
      month: 'Mei',
      year: 2026,
      packagePrice: 150000,
      paidAmount: 100000,
      installmentAmount: 100000,
      status: 'Nyicil',
      paymentHistory: [
        { amount: 60000, method: 'TF', status: 'Nyicil' },
        { amount: 40000, method: 'Cash', status: 'Nyicil' },
      ],
    },
    {
      customerId: 'customer-1',
      month: 'Mei',
      year: 2026,
      packagePrice: 150000,
      paidAmount: 150000,
      installmentAmount: 0,
      status: 'TF',
      paymentHistory: [{ amount: 150000, method: 'TF', status: 'Lunas' }],
    },
    {
      customerId: 'customer-2',
      month: 'April',
      year: 2026,
      packagePrice: 200000,
      paidAmount: 0,
      installmentAmount: 0,
      status: 'Belum Bayar',
    },
  ]);

  assert.deepEqual(summaries, [
    {
      month: 'Mei',
      year: 2026,
      customerCount: 1,
      billingCount: 2,
      totalDue: 300000,
      totalPaid: 250000,
      transferPaid: 210000,
      cashPaid: 40000,
      outstanding: 50000,
      unpaidCustomers: 1,
    },
    {
      month: 'April',
      year: 2026,
      customerCount: 1,
      billingCount: 1,
      totalDue: 200000,
      totalPaid: 0,
      transferPaid: 0,
      cashPaid: 0,
      outstanding: 200000,
      unpaidCustomers: 1,
    },
  ]);
});

test('uses legacy cash and transfer billing statuses when payment history is absent', () => {
  const [summary] = summarizeMonthlyRecap([
    {
      customerId: 'customer-1',
      month: 'Juni',
      year: 2026,
      packagePrice: 120000,
      paidAmount: 0,
      installmentAmount: 0,
      status: 'Cash',
    },
  ]);
  assert.equal(summary.cashPaid, 120000);
  assert.equal(summary.transferPaid, 0);
  assert.equal(summary.outstanding, 0);
});

test('payment method totals never exceed the paid amount recorded on a billing', () => {
  const [summary] = summarizeMonthlyRecap([
    {
      customerId: 'customer-1',
      month: 'Juli',
      year: 2026,
      packagePrice: 100000,
      paidAmount: 100000,
      installmentAmount: 0,
      status: 'Lunas',
      paymentHistory: [
        { amount: 80000, method: 'TF', status: 'Nyicil' },
        { amount: 80000, method: 'Cash', status: 'Lunas' },
      ],
    },
  ]);
  assert.equal(summary.totalPaid, 100000);
  assert.equal(summary.transferPaid, 80000);
  assert.equal(summary.cashPaid, 20000);
});

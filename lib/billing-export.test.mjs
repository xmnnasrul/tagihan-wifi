import assert from 'node:assert/strict';
import test from 'node:test';

import { formatTxtBillingExport } from './billing-export.ts';
import { getBillingOutstandingAmount } from './billing-amounts.ts';

function billing({
  customerId = 'customer-1',
  customerName = 'Budi',
  address = 'Jl. Melati',
  month,
  year = 2026,
  packagePrice = 300000,
  paidAmount = 0,
  installmentAmount = 0,
  status = 'Belum Bayar',
}) {
  return {
    customerId: { toString: () => customerId },
    customerName,
    address,
    month,
    year,
    packagePrice,
    paidAmount,
    installmentAmount,
    status,
  };
}

test('exports one billing month without an amount or month label', () => {
  assert.equal(
    formatTxtBillingExport([billing({ month: 'September' })], getBillingOutstandingAmount),
    '1. Budi Jl. Melati',
  );
});

test('groups customer billings, sums remaining amounts, and displays multiple months', () => {
  const result = formatTxtBillingExport([
    billing({ month: 'September' }),
    billing({ month: 'Oktober', paidAmount: 300000, status: 'Lunas' }),
  ], getBillingOutstandingAmount);

  assert.equal(result, '1. Budi Jl. Melati');
});

test('exports amount and month range when a customer has two unpaid months', () => {
  const result = formatTxtBillingExport([
    billing({ month: 'September' }),
    billing({ month: 'Oktober' }),
  ], getBillingOutstandingAmount);

  assert.equal(result, '1. Budi Jl. Melati 600 (Sep-Okt)');
});

test('lists every unpaid month in the month range', () => {
  const result = formatTxtBillingExport([
    billing({ month: 'September' }),
    billing({ month: 'Oktober' }),
    billing({ month: 'November' }),
  ], getBillingOutstandingAmount);

  assert.equal(result, '1. Budi Jl. Melati 900 (Sep-Okt-Nov)');
});

test('includes years when the billing periods cross calendar years', () => {
  const result = formatTxtBillingExport([
    billing({ month: 'Desember', year: 2025 }),
    billing({ month: 'Januari', year: 2026 }),
  ], getBillingOutstandingAmount);

  assert.equal(result, '1. Budi Jl. Melati 600 (Des 2025-Jan 2026)');
});

test('re-numbers customer groups in name order', () => {
  const result = formatTxtBillingExport([
    billing({ month: 'September', customerId: 'z', customerName: 'Zahra' }),
    billing({ month: 'September', customerId: 'a', customerName: 'Ayu' }),
  ], getBillingOutstandingAmount);

  assert.equal(result, '1. Ayu Jl. Melati\n\n2. Zahra Jl. Melati');
});

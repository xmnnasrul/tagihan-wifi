import { getBillingPaidAmount, getBillingTotalDue } from './billing-amounts.ts';
import type { PaymentStatus } from './models/Billing';

export interface MonthlyRecapBilling {
  customerId: string;
  month: string;
  year: number;
  packagePrice: number;
  paidAmount: number;
  installmentAmount: number;
  status: PaymentStatus;
  paymentHistory?: Array<{
    amount: number;
    status?: string;
    method?: string;
  }>;
}

export interface MonthlyRecap {
  month: string;
  year: number;
  customerCount: number;
  billingCount: number;
  totalDue: number;
  totalPaid: number;
  transferPaid: number;
  cashPaid: number;
  outstanding: number;
  unpaidCustomers: number;
}

const monthIndexes = new Map([
  ['Januari', 0], ['Februari', 1], ['Maret', 2], ['April', 3],
  ['Mei', 4], ['Juni', 5], ['Juli', 6], ['Agustus', 7],
  ['September', 8], ['Oktober', 9], ['November', 10], ['Desember', 11],
]);

function getPaymentMethodTotal(
  billing: MonthlyRecapBilling,
  method: 'TF' | 'Cash',
  paidAmount: number,
) {
  if (billing.paymentHistory?.length) {
    return billing.paymentHistory.reduce((total, payment) => {
      const recordedMethod = payment.method || payment.status;
      return recordedMethod === method && Number.isFinite(payment.amount)
        ? total + payment.amount
        : total;
    }, 0);
  }
  return billing.status === method ? paidAmount : 0;
}

export function summarizeMonthlyRecap(billings: readonly MonthlyRecapBilling[]): MonthlyRecap[] {
  const summaries = new Map<string, {
    month: string;
    year: number;
    customers: Set<string>;
    unpaidCustomers: Set<string>;
    billingCount: number;
    totalDue: number;
    totalPaid: number;
    transferPaid: number;
    cashPaid: number;
    outstanding: number;
  }>();

  for (const billing of billings) {
    const key = `${billing.year}-${billing.month}`;
    const summary = summaries.get(key) || {
      month: billing.month,
      year: billing.year,
      customers: new Set<string>(),
      unpaidCustomers: new Set<string>(),
      billingCount: 0,
      totalDue: 0,
      totalPaid: 0,
      transferPaid: 0,
      cashPaid: 0,
      outstanding: 0,
    };
    const due = getBillingTotalDue(billing);
    const paid = getBillingPaidAmount(billing);
    const outstanding = Math.max(0, due - paid);

    summary.customers.add(billing.customerId);
    if (outstanding > 0) summary.unpaidCustomers.add(billing.customerId);
    summary.billingCount += 1;
    summary.totalDue += due;
    summary.totalPaid += paid;
    const transferPaid = Math.min(paid, Math.max(0, getPaymentMethodTotal(billing, 'TF', paid)));
    const cashPaid = Math.min(paid - transferPaid, Math.max(0, getPaymentMethodTotal(billing, 'Cash', paid)));
    summary.transferPaid += transferPaid;
    summary.cashPaid += cashPaid;
    summary.outstanding += outstanding;
    summaries.set(key, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      month: summary.month,
      year: summary.year,
      customerCount: summary.customers.size,
      billingCount: summary.billingCount,
      totalDue: summary.totalDue,
      totalPaid: summary.totalPaid,
      transferPaid: summary.transferPaid,
      cashPaid: summary.cashPaid,
      outstanding: summary.outstanding,
      unpaidCustomers: summary.unpaidCustomers.size,
    }))
    .sort((first, second) =>
      second.year - first.year
      || (monthIndexes.get(second.month) ?? -1) - (monthIndexes.get(first.month) ?? -1));
}

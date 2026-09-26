import type { IBilling } from '@/lib/models/Billing';

type BillingAmounts = Pick<IBilling, 'totalDue' | 'packagePrice' | 'carriedAmount' | 'paidAmount' | 'installmentAmount' | 'status'>;

export function getBillingTotalDue(billing: BillingAmounts): number {
  return billing.totalDue || billing.packagePrice + (billing.carriedAmount || 0);
}

export function getBillingPaidAmount(billing: BillingAmounts): number {
  if (billing.paidAmount > 0) return billing.paidAmount;
  if (billing.status === 'TF' || billing.status === 'Cash' || billing.status === 'Lunas') {
    return getBillingTotalDue(billing);
  }
  return billing.installmentAmount || 0;
}
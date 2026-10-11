import type { IBilling } from '@/lib/models/Billing';

type BillingAmounts = Pick<IBilling, 'packagePrice' | 'paidAmount' | 'installmentAmount' | 'status'>
  & Partial<Pick<IBilling, 'totalDue' | 'carriedAmount'>>;

type BillingSettlementItem = BillingAmounts & {
  paymentHistory?: Array<{ amount: number; addedAt?: Date | string; addedBy?: string; status?: string; method?: 'Cash' | 'TF'; note?: string; isSettlementAllocation?: boolean }>;
};

export function getBillingTotalDue(billing: BillingAmounts): number {
  return billing.packagePrice;
}

export function getBillingPaidAmount(billing: BillingAmounts): number {
  if (billing.paidAmount > 0) return Math.min(billing.packagePrice, billing.paidAmount);
  if (billing.status === 'TF' || billing.status === 'Cash' || billing.status === 'Lunas') {
    return getBillingTotalDue(billing);
  }
  return Math.min(billing.packagePrice, billing.installmentAmount || 0);
}

export function getBillingOutstandingAmount(billing: BillingAmounts): number {
  return Math.max(0, getBillingTotalDue(billing) - getBillingPaidAmount(billing));
}

export function getMonthlyBillingAmounts(billing: BillingAmounts): { due: number; paid: number; outstanding: number } {
  const due = billing.packagePrice;
  const paid = Math.min(due, Math.max(0, getBillingPaidAmount(billing)));

  return { due, paid, outstanding: getBillingOutstandingAmount(billing) };
}

export function applyPaymentToPreviousBillings<T extends BillingSettlementItem>(
  billings: T[],
  paymentAmount: number,
  options: { addedBy?: string; note?: string; appliedAt?: Date; method?: 'Cash' | 'TF'; skipHistoryFor?: T } = {},
): { remaining: number; billings: T[] } {
  const unsettled = [...billings];
  let remaining = Math.max(0, paymentAmount);

  for (const billing of unsettled) {
    if (remaining <= 0) break;

    const totalDue = getBillingTotalDue(billing);
    const currentPaid = getBillingPaidAmount(billing);
    const outstanding = Math.max(0, totalDue - currentPaid);

    if (outstanding <= 0) continue;

    const applied = Math.min(outstanding, remaining);
    const nextPaid = currentPaid + applied;
    const isSettled = nextPaid >= totalDue;
    const settledStatus = isSettled ? options.method || 'Lunas' : 'Nyicil';

    billing.paidAmount = nextPaid;
    billing.totalDue = totalDue;
    billing.carriedAmount = 0;
    billing.installmentAmount = isSettled ? 0 : nextPaid;
    billing.status = settledStatus;

    if (billing !== options.skipHistoryFor) {
      billing.paymentHistory = billing.paymentHistory || [];
      billing.paymentHistory.push({
        amount: applied,
        addedAt: options.appliedAt ?? new Date(),
        addedBy: options.addedBy || 'Sistem',
        status: isSettled ? settledStatus : 'Nyicil',
        method: options.method,
        note: options.note || 'Pelunasan tunggakan otomatis',
        isSettlementAllocation: true,
      });
    }

    remaining -= applied;
  }

  return { remaining, billings: unsettled };
}
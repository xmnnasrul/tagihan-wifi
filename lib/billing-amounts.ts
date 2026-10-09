import type { IBilling } from '@/lib/models/Billing';

type BillingAmounts = Pick<IBilling, 'totalDue' | 'packagePrice' | 'carriedAmount' | 'paidAmount' | 'installmentAmount' | 'status'>;

type BillingSettlementItem = BillingAmounts & {
  paymentHistory?: Array<{ amount: number; addedAt?: Date | string; addedBy?: string; status?: string; note?: string; isSettlementAllocation?: boolean }>;
};

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

export function getMonthlyBillingAmounts(billing: BillingAmounts): { due: number; paid: number; outstanding: number } {
  const due = billing.packagePrice;
  const paidIncludingCarry = getBillingPaidAmount(billing);
  const paid = Math.min(due, Math.max(0, paidIncludingCarry - (billing.carriedAmount || 0)));

  return { due, paid, outstanding: Math.max(0, due - paid) };
}

export function applyPaymentToPreviousBillings<T extends BillingSettlementItem>(
  billings: T[],
  paymentAmount: number,
  options: { addedBy?: string; note?: string; appliedAt?: Date } = {},
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
    const settledStatus = nextPaid >= totalDue ? 'Lunas' : 'Nyicil';

    billing.paidAmount = nextPaid;
    billing.installmentAmount = settledStatus === 'Lunas' ? 0 : nextPaid;
    billing.status = settledStatus;

    billing.paymentHistory = billing.paymentHistory || [];
    billing.paymentHistory.push({
      amount: applied,
      addedAt: options.appliedAt ?? new Date(),
      addedBy: options.addedBy || 'Sistem',
      status: settledStatus === 'Lunas' ? 'Lunas' : 'Nyicil',
      note: options.note || 'Pelunasan tunggakan otomatis',
      isSettlementAllocation: true,
    });

    remaining -= applied;
  }

  return { remaining, billings: unsettled };
}
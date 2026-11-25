import {
  filterPeriodsThroughMonth,
  getArrearsMonthCount,
} from './arrears-periods.ts';

export type ArrearsBucketKey = '1' | '2' | '3+';
export type ArrearsStatus = 'Belum Bayar' | 'Nyicil';
export type ArrearsStatusFilter = 'all' | ArrearsStatus;

export interface ArrearsPeriodSlice {
  month: string;
  year: number;
  billedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: ArrearsStatus;
}

export interface ArrearsCustomerInput {
  customerId: string;
  customerName: string;
  address: string;
  totalOutstanding: number;
  outstandingPeriods: ArrearsPeriodSlice[];
}

export interface ArrearsCustomerSlice extends ArrearsCustomerInput {
  arrearsMonthCount: number;
}

export interface ArrearsBucket {
  key: ArrearsBucketKey;
  label: string;
  customerCount: number;
  totalOutstanding: number;
  share: number;
  percent: number;
}

export interface ArrearsViewFilters {
  cutoff: { month: string; year: number } | null;
  status: ArrearsStatusFilter;
}

export interface ArrearsView {
  customers: ArrearsCustomerSlice[];
  buckets: ArrearsBucket[];
  totalOutstanding: number;
  periodCount: number;
}

export function getArrearsBucketKey(arrearsMonthCount: number): ArrearsBucketKey {
  if (arrearsMonthCount >= 3) return '3+';
  if (arrearsMonthCount === 2) return '2';
  return '1';
}

export function getArrearsBuckets(customers: readonly ArrearsCustomerSlice[]): ArrearsBucket[] {
  const buckets: ArrearsBucket[] = [
    { key: '1', label: '1 bulan', customerCount: 0, totalOutstanding: 0, share: 0, percent: 0 },
    { key: '2', label: '2 bulan', customerCount: 0, totalOutstanding: 0, share: 0, percent: 0 },
    { key: '3+', label: '3+ bulan', customerCount: 0, totalOutstanding: 0, share: 0, percent: 0 },
  ];

  for (const customer of customers) {
    const bucketKey = getArrearsBucketKey(customer.arrearsMonthCount);
    const bucket = buckets.find((item) => item.key === bucketKey);
    if (!bucket) continue;

    bucket.customerCount += 1;
    bucket.totalOutstanding += customer.totalOutstanding;
  }

  const grandTotal = customers.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
  for (const bucket of buckets) {
    bucket.share = grandTotal > 0 ? bucket.totalOutstanding / grandTotal : 0;
  }
  distributePercents(buckets).forEach((percent, index) => {
    buckets[index].percent = percent;
  });

  return buckets;
}

function distributePercents(buckets: readonly ArrearsBucket[]) {
  if (buckets.every((bucket) => bucket.share === 0)) return buckets.map(() => 0);

  const exact = buckets.map((bucket) => bucket.share * 100);
  const floors = exact.map(Math.floor);
  const remaining = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let index = 0; index < remaining; index += 1) {
    floors[byRemainder[index].index] += 1;
  }

  return floors;
}

export function buildArrearsView(
  customers: readonly ArrearsCustomerInput[],
  filters: ArrearsViewFilters,
): ArrearsView {
  const viewCustomers = customers.flatMap((customer) => {
    const periodsThroughCutoff = filterPeriodsThroughMonth(customer.outstandingPeriods, filters.cutoff);
    const outstandingPeriods = filters.status === 'all'
      ? periodsThroughCutoff
      : periodsThroughCutoff.filter((period) => period.status === filters.status);

    if (outstandingPeriods.length === 0) return [];

    return [{
      ...customer,
      outstandingPeriods,
      totalOutstanding: outstandingPeriods.reduce((sum, period) => sum + period.outstandingAmount, 0),
      arrearsMonthCount: getArrearsMonthCount(outstandingPeriods, filters.cutoff),
    }];
  });

  return {
    customers: viewCustomers,
    buckets: getArrearsBuckets(viewCustomers),
    totalOutstanding: viewCustomers.reduce((sum, customer) => sum + customer.totalOutstanding, 0),
    periodCount: viewCustomers.reduce((sum, customer) => sum + customer.outstandingPeriods.length, 0),
  };
}

export function formatArrearsPercent(bucket: Pick<ArrearsBucket, 'share' | 'percent'>) {
  if (bucket.percent > 0) return `${bucket.percent}%`;
  return bucket.share > 0 ? '<1%' : '0%';
}

export function buildArrearsFindingSentence(buckets: readonly ArrearsBucket[]): string {
  const totalCustomers = buckets.reduce((sum, bucket) => sum + bucket.customerCount, 0);
  if (totalCustomers === 0) return 'Belum ada tunggakan yang tercatat.';

  const olderBucket = buckets.find((bucket) => bucket.key === '3+');
  if (!olderBucket || olderBucket.customerCount === 0) {
    return 'Tidak ada tunggakan berumur 3 bulan atau lebih.';
  }

  return `${formatArrearsPercent(olderBucket)} sisa tunggakan sudah berumur 3 bulan atau lebih, mencakup ${olderBucket.customerCount} dari ${totalCustomers} pelanggan yang menunggak.`;
}

export type ArrearsSortKey = 'name' | 'age' | 'amount';
export type ArrearsSortDirection = 'asc' | 'desc';

export function sortArrearsCustomers<T extends ArrearsCustomerSlice>(
  customers: readonly T[],
  sortKey: ArrearsSortKey,
  sortDirection: ArrearsSortDirection,
): T[] {
  const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' });
  const direction = sortDirection === 'asc' ? 1 : -1;

  return [...customers].sort((a, b) => {
    if (sortKey === 'name') {
      return direction * (collator.compare(a.customerName, b.customerName)
        || collator.compare(a.customerId, b.customerId));
    }

    if (sortKey === 'age') {
      return direction * (a.arrearsMonthCount - b.arrearsMonthCount);
    }

    return direction * (a.totalOutstanding - b.totalOutstanding);
  });
}

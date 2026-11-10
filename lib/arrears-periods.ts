export const arrearsMonthOrder = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export interface ArrearsMonth {
  month: string;
  year: number;
}

export function getArrearsPeriodIndex(period: ArrearsMonth) {
  const monthIndex = arrearsMonthOrder.indexOf(period.month);
  if (!Number.isInteger(period.year) || monthIndex < 0) return null;
  return period.year * 12 + monthIndex;
}

export function filterPeriodsThroughMonth<T extends ArrearsMonth>(periods: readonly T[], cutoff: ArrearsMonth | null) {
  if (!cutoff) return [...periods];

  const cutoffIndex = getArrearsPeriodIndex(cutoff);
  if (cutoffIndex === null) return [];

  return periods.filter((period) => {
    const periodIndex = getArrearsPeriodIndex(period);
    return periodIndex !== null && periodIndex <= cutoffIndex;
  });
}

export function getArrearsMonthCount(periods: readonly ArrearsMonth[], cutoff: ArrearsMonth | null) {
  if (periods.length === 0) return 0;
  if (!cutoff) return periods.length;

  const cutoffIndex = getArrearsPeriodIndex(cutoff);
  if (cutoffIndex === null) return periods.length;

  const periodIndexes = periods
    .map(getArrearsPeriodIndex)
    .filter((index): index is number => index !== null);
  if (periodIndexes.length === 0) return periods.length;

  const oldestPeriodIndex = Math.min(...periodIndexes);
  return Math.max(periods.length, cutoffIndex - oldestPeriodIndex + 1);
}
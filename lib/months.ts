export const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const;

export type MonthName = (typeof MONTHS)[number];

export const MONTH_NAMES: readonly string[] = MONTHS;

export function getMonthIndex(month: string): number {
  return MONTHS.indexOf(month as MonthName);
}

export function getMonthPeriodIndex(month: string, year: number): number {
  return year * 12 + getMonthIndex(month);
}

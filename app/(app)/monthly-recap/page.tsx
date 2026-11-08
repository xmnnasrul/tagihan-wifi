'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Loader2, RotateCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MonthlyRecap {
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

type Category = 'pelanggan' | 'total-tagihan' | 'total-dibayar' | 'transfer' | 'tunai' | 'sisa-tagihan' | 'pelanggan-belum-bayar';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const categories: Array<{
  key: Category;
  label: string;
  description: string;
  value: (row: MonthlyRecap) => number;
  format?: 'currency';
}> = [
  { key: 'pelanggan', label: 'Pelanggan ditagih', description: 'Pelanggan', value: (row) => row.customerCount },
  { key: 'total-tagihan', label: 'Total tagihan', description: 'Nilai tagihan', value: (row) => row.totalDue, format: 'currency' },
  { key: 'total-dibayar', label: 'Total pembayaran', description: 'Semua metode tercatat', value: (row) => row.totalPaid, format: 'currency' },
  { key: 'transfer', label: 'Pembayaran transfer', description: 'Metode transfer tercatat', value: (row) => row.transferPaid, format: 'currency' },
  { key: 'tunai', label: 'Pembayaran tunai', description: 'Metode tunai tercatat', value: (row) => row.cashPaid, format: 'currency' },
  { key: 'sisa-tagihan', label: 'Sisa tagihan', description: 'Belum lunas atau dicicil', value: (row) => row.outstanding, format: 'currency' },
  { key: 'pelanggan-belum-bayar', label: 'Pelanggan belum lunas', description: 'Masih memiliki sisa', value: (row) => row.unpaidCustomers },
];

const currentYear = () => Number(new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
}).format(new Date()));

const currentMonth = () => new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  month: 'long',
}).format(new Date());

const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(amount);

function emptyMonth(month: string, year: number): MonthlyRecap {
  return {
    month,
    year,
    customerCount: 0,
    billingCount: 0,
    totalDue: 0,
    totalPaid: 0,
    transferPaid: 0,
    cashPaid: 0,
    outstanding: 0,
    unpaidCustomers: 0,
  };
}

export default function MonthlyRecapPage() {
  const [recaps, setRecaps] = useState<MonthlyRecap[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMonth = params.get('month');
    const requestedYear = params.get('year');
    if (requestedMonth && months.includes(requestedMonth)) setSelectedMonth(requestedMonth);
    if (requestedYear && /^\d{4}$/.test(requestedYear)) {
      const year = Number(requestedYear);
      if (year >= 2000 && year <= 2100) setSelectedYear(year);
    }
  }, []);

  const fetchRecaps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/monthly-recap');
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data.error || 'Gagal memuat rekap bulanan.');
      }

      const sorted = (data as MonthlyRecap[]).sort((a, b) => b.year - a.year
        || months.indexOf(b.month) - months.indexOf(a.month));
      const initialYear = sorted.some((row) => row.year === currentYear())
        ? currentYear()
        : sorted[0]?.year ?? currentYear();
      setRecaps(sorted);
      setSelectedYear((year) => year ?? initialYear);
      setSelectedMonth((month) => month || (
        sorted.some((row) => row.year === initialYear && row.month === currentMonth())
          ? currentMonth()
          : sorted.find((row) => row.year === initialYear)?.month ?? months[0]
      ));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat rekap bulanan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecaps();
  }, [fetchRecaps]);

  const availableYears = useMemo(() => {
    const years = [...new Set(recaps.map((row) => row.year))].sort((a, b) => b - a);
    if (selectedYear !== null && !years.includes(selectedYear)) years.unshift(selectedYear);
    return years.length > 0 ? years : [currentYear()];
  }, [recaps, selectedYear]);

  const visibleMonths = useMemo(() => {
    if (selectedYear === null) return [];
    return months.map((month) =>
      recaps.find((row) => row.month === month && row.year === selectedYear) || emptyMonth(month, selectedYear));
  }, [recaps, selectedYear]);

  const selectedRecap = visibleMonths.find((row) => row.month === selectedMonth)
    || visibleMonths[0]
    || emptyMonth(selectedMonth || currentMonth(), selectedYear ?? currentYear());
  const collectionRate = selectedRecap.totalDue > 0
    ? Math.min(100, Math.round((selectedRecap.totalPaid / selectedRecap.totalDue) * 100))
    : 0;
  const getCategoryHref = (category: Category, row: MonthlyRecap) => {
    const query = new URLSearchParams({ month: row.month, year: String(row.year) });
    return `/dashboard/billings/${category}?${query.toString()}`;
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const matchingMonths = months.map((month) =>
      recaps.find((row) => row.month === month && row.year === year));
    const fallbackMonth = year === currentYear() && matchingMonths.some((row) => row?.month === currentMonth())
      ? currentMonth()
      : matchingMonths.find((row) => row && row.billingCount > 0)?.month || months[0];
    setSelectedMonth(fallbackMonth);
  };

  return (
    <div className="app-page mx-auto w-full max-w-[1440px] space-y-6 p-4 pb-8 sm:space-y-7 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rekap Bulanan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau tagihan dan pembayaran sepanjang tahun.
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm font-medium sm:justify-start">
          Tahun laporan
          <select
            value={selectedYear ?? ''}
            onChange={(event) => handleYearChange(Number(event.target.value))}
            disabled={loading && recaps.length === 0}
            className="h-10 min-w-28 rounded-md border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {selectedYear === null && <option value="" disabled>Pilih tahun</option>}
            {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => void fetchRecaps()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCw className="h-4 w-4" /> Coba lagi
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Pilih periode</h2>
        {loading && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memperbarui
          </span>
        )}
      </div>
      <nav className="-mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Pilih bulan laporan">
        {visibleMonths.map((row, index) => {
          const isSelected = row.month === selectedRecap.month;
          return (
            <motion.button
              key={row.month}
              type="button"
              onClick={() => setSelectedMonth(row.month)}
              aria-pressed={isSelected}
              whileHover={prefersReducedMotion ? undefined : { y: -2 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className={`relative min-w-[66px] shrink-0 overflow-hidden rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? 'border-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {isSelected && (
                <motion.span
                  layoutId="monthly-recap-active-period"
                  className="absolute inset-0 rounded-[inherit] bg-foreground"
                  transition={prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 420, damping: 34 }}
                  aria-hidden="true"
                />
              )}
              <span className="relative block text-xs font-medium">{shortMonths[index]}</span>
              <span className={`relative mt-1 block text-[11px] tabular-nums ${isSelected ? 'text-background/75' : 'text-muted-foreground'}`}>
                {row.customerCount} org
              </span>
            </motion.button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={`${selectedRecap.year}-${selectedRecap.month}`}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]"
        aria-label={`Ringkasan ${selectedRecap.month} ${selectedRecap.year}`}
        aria-busy={loading}
      >
        <Card className="border-border/70">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Pembayaran terkumpul</p>
                <p className="mt-2 break-words text-3xl font-semibold leading-none tabular-nums sm:text-4xl">
                  {formatRupiah(selectedRecap.totalPaid)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  dari {formatRupiah(selectedRecap.totalDue)} tagihan · {selectedRecap.customerCount} pelanggan
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{collectionRate}%</p>
                <p className="text-xs text-muted-foreground">terbayar</p>
              </div>
            </div>
            <div
              role="progressbar"
              aria-label={`Progres pembayaran ${selectedRecap.month} ${selectedRecap.year}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={collectionRate}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <motion.div
                className="h-full origin-left rounded-full bg-[#1d5fbf]"
                initial={prefersReducedMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: collectionRate / 100 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeOut' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border/70 pt-4 sm:grid-cols-3">
              {(['transfer', 'tunai', 'total-dibayar'] as const).map((key) => {
                const category = categories.find((item) => item.key === key)!;
                const value = category.value(selectedRecap);
                return (
                  <Link
                    key={key}
                    href={getCategoryHref(key, selectedRecap)}
                    className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block text-xs text-muted-foreground">{category.label}</span>
                    <span className="mt-1 block break-words text-sm font-medium tabular-nums group-hover:text-primary">
                      {formatRupiah(value)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-2" aria-labelledby="follow-up-heading">
          <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
            <h2 id="follow-up-heading" className="text-base font-semibold">Perlu ditindaklanjuti</h2>
            <span className="text-xs text-muted-foreground">{selectedRecap.month} {selectedRecap.year}</span>
          </div>
          <Link
            href={getCategoryHref('sisa-tagihan', selectedRecap)}
            className="group flex items-center justify-between gap-3 rounded-md border border-border/70 p-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">Sisa tagihan</span>
              <span className="mt-0.5 block break-words text-base font-semibold tabular-nums">{formatRupiah(selectedRecap.outstanding)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Tagihan belum lunas atau dicicil</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={getCategoryHref('pelanggan-belum-bayar', selectedRecap)}
            className="group flex items-center justify-between gap-3 rounded-md border border-border/70 p-3.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">Pelanggan belum lunas</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{selectedRecap.unpaidCustomers} pelanggan masih memiliki saldo</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </section>
      </motion.section>
      </AnimatePresence>

      <section aria-labelledby="period-numbers-heading" aria-busy={loading}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h2 id="period-numbers-heading" className="text-base font-semibold">Rincian periode</h2>
            <p className="mt-1 text-xs text-muted-foreground">{selectedRecap.month} {selectedRecap.year} · Pilih angka untuk melihat daftar</p>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">Nilai dalam rupiah</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-md bg-muted/30 p-4 sm:grid-cols-3 sm:gap-y-6 lg:grid-cols-4 xl:grid-cols-7">
          {categories.map((category) => {
            const value = category.value(selectedRecap);
            return (
              <Link
                key={category.key}
                href={getCategoryHref(category.key, selectedRecap)}
                aria-label={`${category.label}, ${selectedRecap.month} ${selectedRecap.year}: ${category.format === 'currency' ? formatRupiah(value) : value}`}
                className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block text-xs leading-4 text-muted-foreground">{category.label}</span>
                <motion.span
                  whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  className="mt-1.5 block break-words text-sm font-semibold leading-tight tabular-nums group-hover:text-primary sm:text-base"
                >
                  {category.format === 'currency' ? formatRupiah(value) : value}
                </motion.span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{category.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

    </div>
  );
}

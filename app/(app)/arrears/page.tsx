'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
  MapPin,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getArrearsPeriodIndex } from '@/lib/arrears-periods';
import {
  buildArrearsView,
  formatArrearsPercent,
  sortArrearsCustomers,
  type ArrearsCustomerInput,
  type ArrearsPeriodSlice,
  type ArrearsSortDirection,
  type ArrearsSortKey,
  type ArrearsStatusFilter,
} from '@/lib/arrears-summary';

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const sortLabels: Record<ArrearsSortKey, string> = {
  name: 'nama pelanggan',
  age: 'umur tunggakan',
  amount: 'sisa tagihan',
};

function SortIcon({ active, direction }: { active: boolean; direction: ArrearsSortDirection }) {
  if (!active) {
    return <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden="true" />;
  }
  const Icon = direction === 'asc' ? ArrowUp : ArrowDown;
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}

function SortHeaderButton({
  label,
  active,
  direction,
  align = 'left',
  onClick,
}: {
  label: string;
  active: boolean;
  direction: ArrearsSortDirection;
  align?: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
        align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
      } ${active ? 'text-foreground' : 'text-muted-foreground'}`}
    >
      {label}
      <SortIcon active={active} direction={direction} />
    </button>
  );
}

function PeriodList({ periods }: { periods: ArrearsPeriodSlice[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {periods.map((period) => (
        <li
          key={`${period.year}-${period.month}`}
          className="rounded-md border border-border/60 bg-background/70 px-3 py-2"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium">{period.month} {period.year}</span>
            <span className="text-xs font-semibold tabular-nums">Sisa {formatRupiah(period.outstandingAmount)}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            Tagihan {formatRupiah(period.billedAmount)} · dibayar {formatRupiah(period.paidAmount)} · {period.status}
          </p>
        </li>
      ))}
    </ul>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" aria-hidden="true">
      <div className="space-y-3 p-4 sm:p-6 lg:p-7">
        <div className="h-4 w-28 rounded-sm bg-muted" />
        <div className="h-10 w-56 max-w-full rounded-sm bg-muted" />
        <div className="h-3 w-44 max-w-full rounded-sm bg-muted/70" />
        <div className="h-3 w-72 max-w-full rounded-sm bg-muted/60" />
      </div>
      <div className="space-y-5 border-t border-border/80 p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-16 rounded-sm bg-muted" />
              <div className="h-3 w-20 rounded-sm bg-muted/70" />
            </div>
            <div className="h-1.5 rounded-full bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArrearsPage() {
  const [report, setReport] = useState<ArrearsCustomerInput[]>([]);
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ArrearsStatusFilter>('all');
  const [sortKey, setSortKey] = useState<ArrearsSortKey>('age');
  const [sortDirection, setSortDirection] = useState<ArrearsSortDirection>('desc');
  const [hasSorted, setHasSorted] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let isCurrentRequest = true;
    async function fetchReport() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/arrears');
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data.error || 'Gagal memuat laporan tunggakan');
        }
        if (isCurrentRequest) setReport(data);
      } catch (fetchError) {
        if (isCurrentRequest) setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat laporan tunggakan');
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    }
    void fetchReport();
    return () => {
      isCurrentRequest = false;
    };
  }, [reloadKey]);

  const monthCutoff = useMemo(() => {
    if (monthFilter === 'all') return null;
    const [yearText, month] = monthFilter.split('-', 2);
    const year = Number(yearText);
    return Number.isInteger(year) && month ? { year, month } : null;
  }, [monthFilter]);

  const monthOptions = useMemo(() => {
    const periods = new Map<string, ArrearsPeriodSlice>();
    report.forEach((customer) => customer.outstandingPeriods.forEach((period) => {
      periods.set(`${period.year}-${period.month}`, period);
    }));

    return Array.from(periods.values())
      .sort((a, b) => (getArrearsPeriodIndex(b) ?? 0) - (getArrearsPeriodIndex(a) ?? 0))
      .map((period) => ({ value: `${period.year}-${period.month}`, label: `${period.month} ${period.year}` }));
  }, [report]);

  const view = useMemo(
    () => buildArrearsView(report, { cutoff: monthCutoff, status: statusFilter }),
    [report, monthCutoff, statusFilter],
  );

  const sortedCustomers = useMemo(
    () => sortArrearsCustomers(view.customers, sortKey, sortDirection),
    [view.customers, sortKey, sortDirection],
  );

  const isFiltered = monthFilter !== 'all' || statusFilter !== 'all';
  const isInitialLoading = loading && report.length === 0;
  const sortStatus = `Diurutkan berdasarkan ${sortLabels[sortKey]}, ${sortDirection === 'asc' ? 'naik' : 'turun'}.`;

  const handleSort = (key: ArrearsSortKey) => {
    setHasSorted(true);
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  };

  const earliestPeriod = useMemo(() => {
    const periods = view.customers.flatMap((customer) => customer.outstandingPeriods[0] ?? []);
    return periods.reduce<ArrearsPeriodSlice | null>((earliest, period) => {
      if (!earliest) return period;
      return (getArrearsPeriodIndex(period) ?? 0) < (getArrearsPeriodIndex(earliest) ?? 0) ? period : earliest;
    }, null);
  }, [view.customers]);

  const averageOutstanding = view.customers.length > 0
    ? Math.round(view.totalOutstanding / view.customers.length)
    : 0;

  const ariaSortFor = (key: ArrearsSortKey): 'ascending' | 'descending' | undefined => {
    if (sortKey !== key) return undefined;
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setMonthFilter('all');
  };

  const toggleDetails = (customerId: string) => {
    setExpandedId((current) => (current === customerId ? null : customerId));
  };

  return (
    <div className="space-y-4 sm:space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Laporan Tunggakan</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sisa tagihan yang belum lunas, dikelompokkan menurut umur tunggakan.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali ke Dashboard
        </Link>
      </header>

      {!error && (isInitialLoading || view.customers.length > 0) && (
        <section
          aria-label="Ringkasan tunggakan"
          aria-busy={isInitialLoading}
          className="overflow-hidden rounded-lg border border-border/80 bg-card"
        >
          {isInitialLoading ? (
            <SummarySkeleton />
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="p-4 sm:p-6 lg:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-sm font-medium text-muted-foreground">Sisa tunggakan</h2>
                  {isFiltered && <span className="text-xs text-muted-foreground">Total mengikuti filter</span>}
                </div>
                <p className="mt-1 break-words text-3xl sm:mt-1.5 sm:text-4xl font-semibold leading-none tracking-tight tabular-nums">
                  {formatRupiah(view.totalOutstanding)}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground sm:mt-3">
                  {view.customers.length} pelanggan · {view.periodCount} periode belum lunas
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-2 sm:mt-4 sm:pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tunggakan tertua</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {earliestPeriod ? `${earliestPeriod.month} ${earliestPeriod.year}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rata-rata sisa</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums">{formatRupiah(averageOutstanding)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/80 p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-medium">Umur tunggakan</h2>
                  <span className="text-xs text-muted-foreground">Porsi sisa</span>
                </div>
                <ul className="mt-3 space-y-3 sm:mt-4 sm:space-y-5">
                  {view.buckets.map((bucket) => {
                    const isOlder = bucket.key === '3+' && bucket.customerCount > 0;
                    return (
                      <li key={bucket.key}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={`text-sm font-medium ${isOlder ? 'text-destructive' : ''}`}>{bucket.label}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{bucket.customerCount} pelanggan</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className={`h-full origin-left rounded-full ${isOlder ? 'bg-destructive' : 'bg-primary/45'}`}
                            initial={prefersReducedMotion ? false : { scaleX: 0 }}
                            animate={{ scaleX: bucket.share }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: 'easeOut' }}
                          />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-3 text-xs tabular-nums text-muted-foreground">
                          <span>{formatRupiah(bucket.totalOutstanding)}</span>
                          <span>{formatArrearsPercent(bucket)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      <section aria-label="Filter laporan" className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="arrears-status" className="text-xs font-medium text-muted-foreground">Status tunggakan</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ArrearsStatusFilter)}>
              <SelectTrigger id="arrears-status" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="Belum Bayar">Belum Bayar</SelectItem>
                <SelectItem value="Nyicil">Nyicil</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="arrears-month" className="text-xs font-medium text-muted-foreground">Sampai bulan</label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger id="arrears-month" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua bulan</SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isFiltered && !loading && !error && (
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Hapus filter
          </Button>
        )}
      </section>

      <section aria-labelledby="arrears-list-heading" aria-busy={loading} className="space-y-2 sm:space-y-3">
        <div className="space-y-1">
          <h2 id="arrears-list-heading" className="text-base font-semibold">Pelanggan menunggak</h2>
          <div className="flex items-center justify-between gap-3">
            {!loading && !error ? (
              <p className="text-xs tabular-nums text-muted-foreground">
                {view.customers.length} pelanggan · {view.periodCount} periode
              </p>
            ) : <span />}
            {!loading && !error && sortedCustomers.length > 0 && (
              <select
                value={`${sortKey}:${sortDirection}`}
                aria-label="Urutkan daftar pelanggan"
                onChange={(event) => {
                  const [key, direction] = event.target.value.split(':');
                  setSortKey(key as ArrearsSortKey);
                  setSortDirection(direction as ArrearsSortDirection);
                  setHasSorted(true);
                }}
                className="h-9 shrink-0 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                <option value="age:desc">Terlama menunggak</option>
                <option value="age:asc">Terbaru menunggak</option>
                <option value="amount:desc">Sisa terbesar</option>
                <option value="amount:asc">Sisa terkecil</option>
                <option value="name:asc">Nama A-Z</option>
                <option value="name:desc">Nama Z-A</option>
              </select>
            )}
          </div>
        </div>

        <p className="sr-only" role="status">
          {hasSorted ? sortStatus : ''}
        </p>

        {loading ? (
          <div className="divide-y divide-border/70" role="status" aria-label="Memuat laporan tunggakan">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 max-w-full rounded-sm bg-muted" />
                  <div className="h-3 w-56 max-w-full rounded-sm bg-muted/70" />
                </div>
                <div className="h-4 w-24 shrink-0 rounded-sm bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
            <AlertDescription>{error}</AlertDescription>
            <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              Coba lagi
            </Button>
          </Alert>
        ) : sortedCustomers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 px-4 py-12 text-center">
            <p className="text-sm font-medium">
              {report.length === 0 ? 'Tidak ada tagihan yang menunggak.' : 'Tidak ada pelanggan yang cocok dengan filter ini.'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {report.length === 0
                ? 'Semua tagihan pelanggan aktif sudah lunas.'
                : 'Coba longgarkan status atau bulan, lalu lihat kembali daftarnya.'}
            </p>
            {report.length > 0 && isFiltered && (
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                Hapus filter
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table className="min-w-[720px]">
                <TableCaption className="sr-only">
                  Daftar pelanggan menunggak beserta umur tunggakan dan sisa tagihan
                </TableCaption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" aria-sort={ariaSortFor('name')} className="h-auto w-[40%] p-0">
                      <SortHeaderButton
                        label="Pelanggan"
                        active={sortKey === 'name'}
                        direction={sortDirection}
                        onClick={() => handleSort('name')}
                      />
                    </TableHead>
                    <TableHead scope="col" aria-sort={ariaSortFor('age')} className="h-auto w-[18%] p-0">
                      <SortHeaderButton
                        label="Menunggak"
                        active={sortKey === 'age'}
                        direction={sortDirection}
                        onClick={() => handleSort('age')}
                      />
                    </TableHead>
                    <TableHead scope="col" aria-sort={ariaSortFor('amount')} className="h-auto w-[24%] p-0">
                      <SortHeaderButton
                        label="Sisa tagihan"
                        align="right"
                        active={sortKey === 'amount'}
                        direction={sortDirection}
                        onClick={() => handleSort('amount')}
                      />
                    </TableHead>
                    <TableHead scope="col" className="h-auto w-[100px] px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      <span className="sr-only">Rincian tagihan</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCustomers.map((customer) => {
                    const oldestPeriod = customer.outstandingPeriods[0];
                    const paidTotal = customer.outstandingPeriods.reduce((sum, period) => sum + period.paidAmount, 0);
                    const isOld = customer.arrearsMonthCount >= 3;
                    const isExpanded = expandedId === customer.customerId;
                    const detailsId = `arrears-detail-${customer.customerId}`;
                    const customerHref = `/customers/${encodeURIComponent(customer.customerId)}?name=${encodeURIComponent(customer.customerName)}`;

                    return (
                      <Fragment key={customer.customerId}>
                        <TableRow>
                          <TableCell className="max-w-[360px] px-4 py-3.5">
                            <Link
                              href={customerHref}
                              className="rounded-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {customer.customerName}
                            </Link>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                            </p>
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <span className={`text-sm font-medium tabular-nums ${isOld ? 'text-destructive' : ''}`}>
                              {customer.arrearsMonthCount} bulan
                            </span>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              sejak {oldestPeriod.month} {oldestPeriod.year}
                            </p>
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-right">
                            <span className="text-sm font-semibold tabular-nums">{formatRupiah(customer.totalOutstanding)}</span>
                            {paidTotal > 0 && (
                              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                dibayar {formatRupiah(paidTotal)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-controls={detailsId}
                              onClick={() => toggleDetails(customer.customerId)}
                              className="inline-flex min-h-9 items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Rincian
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell id={detailsId} colSpan={4} className="bg-muted/30 px-4 py-3">
                              <PeriodList periods={customer.outstandingPeriods} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border/70 md:hidden">
              {sortedCustomers.map((customer) => {
                const oldestPeriod = customer.outstandingPeriods[0];
                const paidTotal = customer.outstandingPeriods.reduce((sum, period) => sum + period.paidAmount, 0);
                const isOld = customer.arrearsMonthCount >= 3;
                const isExpanded = expandedId === customer.customerId;
                const detailsId = `arrears-detail-mobile-${customer.customerId}`;
                const customerHref = `/customers/${encodeURIComponent(customer.customerId)}?name=${encodeURIComponent(customer.customerName)}`;

                return (
                  <article key={customer.customerId} className="py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={customerHref}
                          className="rounded-sm font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {customer.customerName}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="min-w-0 text-sm font-semibold tabular-nums whitespace-nowrap">{formatRupiah(customer.totalOutstanding)}</p>
                        {paidTotal > 0 && (
                          <p className="text-[11px] tabular-nums text-muted-foreground">dibayar {formatRupiah(paidTotal)}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <p className="min-w-0 text-xs text-muted-foreground">
                        <span className={`font-medium ${isOld ? 'text-destructive' : 'text-foreground'}`}>
                          {customer.arrearsMonthCount} bulan
                        </span>{' '}
                        · sejak {oldestPeriod.month} {oldestPeriod.year}
                      </p>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() => toggleDetails(customer.customerId)}
                        className="-mr-2 inline-flex min-h-10 shrink-0 items-center gap-1 rounded-sm px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Rincian
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    {isExpanded && (
                      <div id={detailsId} className="mt-3">
                        <PeriodList periods={customer.outstandingPeriods} />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

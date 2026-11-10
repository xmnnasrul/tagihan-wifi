'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, MapPin } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  filterPeriodsThroughMonth,
  getArrearsMonthCount,
  getArrearsPeriodIndex,
} from '@/lib/arrears-periods';

interface OutstandingPeriod {
  month: string;
  year: number;
  billedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'Belum Bayar' | 'Nyicil';
}

interface ArrearsCustomer {
  customerId: string;
  customerName: string;
  address: string;
  totalOutstanding: number;
  outstandingPeriods: OutstandingPeriod[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getArrearsAgeStyle(monthCount: number) {
  if (monthCount >= 3) {
    return { rail: 'border-l-destructive', marker: 'bg-destructive', text: 'text-destructive' };
  }
  if (monthCount === 2) {
    return { rail: 'border-l-amber-500', marker: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-400' };
  }
  return { rail: 'border-l-border', marker: 'bg-border', text: 'text-muted-foreground' };
}

function PeriodBreakdown({ periods }: { periods: OutstandingPeriod[] }) {
  return (
    <details className="group min-w-0">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Rincian tagihan
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-1 space-y-2 border-l border-border pl-3">
        {periods.map((period) => (
          <div key={`${period.year}-${period.month}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 text-xs">
            <span className="font-medium">{period.month} {period.year}</span>
            <span className="text-right font-medium tabular-nums">Sisa {formatRupiah(period.outstandingAmount)}</span>
            <span className="col-span-2 text-muted-foreground">
              Tagihan {formatRupiah(period.billedAmount)} · Dibayar {formatRupiah(period.paidAmount)}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function ArrearsPage() {
  const [report, setReport] = useState<ArrearsCustomer[]>([]);
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Belum Bayar' | 'Nyicil'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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
    const periods = new Map<string, OutstandingPeriod>();
    report.forEach((customer) => customer.outstandingPeriods.forEach((period) => {
      periods.set(`${period.year}-${period.month}`, period);
    }));

    return Array.from(periods.values())
      .sort((a, b) => (getArrearsPeriodIndex(b) ?? 0) - (getArrearsPeriodIndex(a) ?? 0))
      .map((period) => ({ value: `${period.year}-${period.month}`, label: `${period.month} ${period.year}` }));
  }, [report]);

  const baseReport = useMemo(() => report.flatMap((customer) => {
    const outstandingPeriods = filterPeriodsThroughMonth(customer.outstandingPeriods, monthCutoff);
    const matchesStatus = statusFilter === 'all'
      || outstandingPeriods.some((period) => period.status === statusFilter);

    if (!matchesStatus || outstandingPeriods.length === 0) return [];
    return [{
      ...customer,
      outstandingPeriods,
      totalOutstanding: outstandingPeriods.reduce((sum, period) => sum + period.outstandingAmount, 0),
      arrearsMonthCount: getArrearsMonthCount(outstandingPeriods, monthCutoff),
    }];
  }), [report, monthCutoff, statusFilter]);

  const filteredReport = baseReport;

  const totalOutstanding = filteredReport.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
  const outstandingPeriodCount = filteredReport.reduce((sum, customer) => sum + customer.outstandingPeriods.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Tunggakan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pantau sisa tagihan dan lamanya pelanggan menunggak.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </Link>
      </div>

      <section aria-label="Ringkasan tunggakan" className="grid divide-y divide-border border-y border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center justify-between gap-4 py-3 sm:block sm:pr-4">
          <p className="text-sm text-muted-foreground">Total sisa tunggakan</p>
          <p className="text-lg font-semibold tabular-nums text-primary sm:mt-1 sm:text-2xl">{formatRupiah(totalOutstanding)}</p>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 sm:block sm:border-l sm:px-4">
          <p className="text-sm text-muted-foreground">Pelanggan menunggak</p>
          <p className="text-lg font-medium tabular-nums sm:mt-1 sm:text-xl">{filteredReport.length}</p>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 sm:block sm:border-l sm:pl-4">
          <p className="text-sm text-muted-foreground">Periode belum lunas</p>
          <p className="text-lg font-medium tabular-nums sm:mt-1 sm:text-xl">{outstandingPeriodCount}</p>
        </div>
      </section>

      <section aria-label="Filter laporan" className="grid grid-cols-2 gap-3 sm:w-fit sm:grid-cols-[190px_190px] sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="arrears-status" className="text-xs font-medium text-muted-foreground">Status tunggakan</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
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
      </section>

      <section aria-label="Daftar pelanggan menunggak" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">Daftar pelanggan</h2>
          {!loading && !error && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {filteredReport.length} pelanggan · {outstandingPeriodCount} periode
            </p>
          )}
        </div>

        {loading ? (
          <div className="divide-y divide-border/70" role="status" aria-label="Memuat laporan tunggakan">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-4 py-3">
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
        ) : filteredReport.length === 0 ? (
          <div className="border-y border-border/70 py-10 text-center">
            <p className="text-sm font-medium">
              {report.length === 0 ? 'Tidak ada tagihan yang menunggak.' : 'Tidak ada pelanggan yang cocok dengan status atau bulan.'}
            </p>
            {report.length > 0 && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setStatusFilter('all');
                  setMonthFilter('all');
                }}
              >
                Hapus filter
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-md border border-border/70 md:block">
              <Table className="min-w-180">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[36%] font-normal text-muted-foreground">Pelanggan</TableHead>
                    <TableHead className="whitespace-nowrap font-normal text-muted-foreground">Mulai menunggak</TableHead>
                    <TableHead className="font-normal text-muted-foreground">Periode</TableHead>
                    <TableHead className="whitespace-nowrap text-right font-normal text-muted-foreground">Sisa tunggakan</TableHead>
                    <TableHead className="text-right font-normal text-muted-foreground">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReport.map((customer) => {
                    const oldestPeriod = customer.outstandingPeriods[0];
                    const hasUnpaid = customer.outstandingPeriods.some((period) => period.status === 'Belum Bayar');
                    const hasInstallment = customer.outstandingPeriods.some((period) => period.status === 'Nyicil');
                    const customerHref = `/customers/${customer.customerId}?name=${encodeURIComponent(customer.customerName)}`;
                    const ageStyle = getArrearsAgeStyle(customer.arrearsMonthCount);

                    return (
                      <TableRow key={customer.customerId} className="align-middle">
                        <TableCell className="relative max-w-[320px] pl-5">
                          <span aria-hidden="true" className={`absolute bottom-3 left-0 top-3 w-1 rounded-full ${ageStyle.marker}`} />
                          <Link href={customerHref} className="font-semibold hover:text-primary">
                            {customer.customerName}
                          </Link>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {oldestPeriod.month} {oldestPeriod.year}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`whitespace-nowrap text-sm font-semibold tabular-nums ${ageStyle.text}`}>{customer.arrearsMonthCount} bulan</span>
                            {hasUnpaid && <Badge variant="outline" className="whitespace-nowrap border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">Belum Bayar</Badge>}
                            {hasInstallment && <Badge variant="outline" className="whitespace-nowrap border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400">Nyicil</Badge>}
                          </div>
                          <PeriodBreakdown periods={customer.outstandingPeriods} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-base font-semibold tabular-nums text-primary">
                          {formatRupiah(customer.totalOutstanding)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm">
                            <Link href={customerHref}>Lihat</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-border/70 md:hidden">
              {filteredReport.map((customer) => {
                const oldestPeriod = customer.outstandingPeriods[0];
                const hasUnpaid = customer.outstandingPeriods.some((period) => period.status === 'Belum Bayar');
                const hasInstallment = customer.outstandingPeriods.some((period) => period.status === 'Nyicil');
                const customerHref = `/customers/${customer.customerId}?name=${encodeURIComponent(customer.customerName)}`;
                const ageStyle = getArrearsAgeStyle(customer.arrearsMonthCount);

                return (
                  <article key={customer.customerId} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-l-2 py-3 pl-3 ${ageStyle.rail}`}>
                    <div className="min-w-0">
                      <Link href={customerHref} className="block truncate text-base font-semibold hover:text-primary">
                        {customer.customerName}
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{customer.address || 'Alamat belum diisi'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Sisa</p>
                      <p className="whitespace-nowrap text-base font-semibold tabular-nums text-primary">{formatRupiah(customer.totalOutstanding)}</p>
                    </div>
                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="whitespace-nowrap text-muted-foreground">Mulai {oldestPeriod.month} {oldestPeriod.year}</span>
                        <span className={`whitespace-nowrap font-semibold ${ageStyle.text}`}>{customer.arrearsMonthCount} bulan</span>
                        {hasUnpaid && <Badge variant="outline" className="whitespace-nowrap border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">Belum Bayar</Badge>}
                        {hasInstallment && <Badge variant="outline" className="whitespace-nowrap border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400">Nyicil</Badge>}
                      </div>
                      <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 px-2">
                        <Link href={customerHref}>Lihat</Link>
                      </Button>
                    </div>
                    <div className="col-span-2">
                      <PeriodBreakdown periods={customer.outstandingPeriods} />
                    </div>
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
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, MapPin, Search, CalendarDays, ChevronRight, ArrowUpRight, UserPlus, WalletCards, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentUser } from '@/components/CurrentUserProvider';

interface Stats {
  totalCustomers: number;
  archivedCustomers: number;
  unpaidCustomers: number;
  totalBillings: number;
  paidBillings: number;
  unpaidBillings: number;
  installmentBillings: number;
  totalDue: number;
  outstandingAmount: number;
  totalRevenue: number;
  billingStatuses: { customerId: string; status: string }[];
  currentMonth: string;
  currentYear: number;
}

interface DashboardCustomer {
  _id: string;
  name: string;
  address: string;
  packageId: { name: string; speed: string } | null;
  createdAt?: string;
  createdBy?: string;
}

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function DashboardPage() {
  const currentUser = useCurrentUser();
  const prefersReducedMotion = useReducedMotion();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [statsMonth, setStatsMonth] = useState<string | null>(null);
  const [statsMonthPickerOpen, setStatsMonthPickerOpen] = useState(false);
  const [statsYear, setStatsYear] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsRefreshVersion, setStatsRefreshVersion] = useState(0);
  const [customers, setCustomers] = useState<DashboardCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState('');
  const [customersRefreshVersion, setCustomersRefreshVersion] = useState(0);

  useEffect(() => {
    const now = new Date();
    setStatsMonth(months[now.getMonth()]);
    setStatsYear(String(now.getFullYear()));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    if (!currentUser.roles.some((role) => role === 'admin' || role === 'superadmin')) return;

    let isCurrentRequest = true;
    async function ensureCurrentMonthBillings() {
      try {
        const response = await fetch('/api/billings/generate-month', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal membuat tagihan bulan ini');
        if (data.created > 0 && isCurrentRequest) {
          setStatsRefreshVersion((version) => version + 1);
        }
      } catch (err) {
        if (isCurrentRequest) setError(err instanceof Error ? err.message : 'Gagal membuat tagihan bulan ini');
      }
    }
    void ensureCurrentMonthBillings();
    return () => {
      isCurrentRequest = false;
    };
  }, [currentUser]);

  useEffect(() => {
    const month = statsMonth;
    const year = statsYear;
    if (!month || !year) return;
    const params = new URLSearchParams({ month, year });
    let isCurrentRequest = true;
    async function fetchStats() {
      setStatsLoading(true);
      setStats(null);
      setError('');
      try {
        const response = await fetch(`/api/stats?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal memuat statistik');
        if (isCurrentRequest) setStats(data);
      } catch (err) {
        if (isCurrentRequest) setError(err instanceof Error ? err.message : 'Gagal memuat statistik');
      } finally {
        if (isCurrentRequest) setStatsLoading(false);
      }
    }
    void fetchStats();
    return () => {
      isCurrentRequest = false;
    };
  }, [statsMonth, statsYear, statsRefreshVersion]);

  useEffect(() => {
    let isCurrentRequest = true;
    async function fetchCustomers() {
      setCustomersLoading(true);
      setCustomersError('');
      try {
        const response = await fetch('/api/customers');
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data.error || 'Gagal memuat data pelanggan');
        }
        if (isCurrentRequest) setCustomers(data);
      } catch (err) {
        if (isCurrentRequest) setCustomersError(err instanceof Error ? err.message : 'Gagal memuat data pelanggan');
      } finally {
        if (isCurrentRequest) setCustomersLoading(false);
      }
    }
    void fetchCustomers();
    return () => {
      isCurrentRequest = false;
    };
  }, [customersRefreshVersion]);

  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  const formatDateTime = (value?: string) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase('id-ID');
  const matchingCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.address || ''}`.toLocaleLowerCase('id-ID').includes(normalizedCustomerSearch)
  );
  const visibleCustomers = normalizedCustomerSearch ? matchingCustomers : matchingCustomers.slice(0, 6);
  const collectedPercent = stats && stats.totalDue > 0
    ? Math.min(100, Math.round((stats.totalRevenue / stats.totalDue) * 100))
    : 0;
  const periodQuery = new URLSearchParams({
    month: statsMonth ?? '',
    year: statsYear ?? '',
  }).toString();
  const unpaidHref = `/dashboard/billings/unpaid?${periodQuery}`;
  const unpaidCustomersHref = `/dashboard/billings/belum-bayar?${periodQuery}`;
  const recapHref = `/monthly-recap?${periodQuery}`;
  const billingStatusByCustomer = new Map(
    (stats?.billingStatuses ?? []).map((billing) => [billing.customerId, billing.status])
  );
  const dashboardRefreshing = statsLoading || customersLoading;
  const revealInitial = prefersReducedMotion ? false : { opacity: 0, y: 12 };

  const refreshDashboard = () => {
    setStatsRefreshVersion((version) => version + 1);
    setCustomersRefreshVersion((version) => version + 1);
  };

  return (
    <div className="space-y-7 sm:space-y-8">
      <motion.header
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: 'easeOut' }}
        className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Ringkasan tagihan, pembayaran, dan pelanggan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-0 flex-1 justify-between font-normal sm:w-[142px] sm:flex-none"
            aria-label="Pilih bulan periode keuangan"
            onClick={() => setStatsMonthPickerOpen(true)}
          >
            {statsMonth ?? 'Memuat...'}
          </Button>
          <Select value={statsYear ?? ''} onValueChange={setStatsYear}>
            <SelectTrigger className="w-[94px]" aria-label="Tahun periode keuangan">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, index) => 2026 + index).map((year) => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Muat ulang dashboard"
            title="Muat ulang dashboard"
            disabled={dashboardRefreshing}
            onClick={refreshDashboard}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button asChild aria-label="Tambah pelanggan" title="Tambah pelanggan" className="h-10 w-10 p-0 sm:h-9 sm:w-auto sm:gap-2 sm:px-4">
            <Link href="/billing/add">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Tambah pelanggan</span>
            </Link>
          </Button>
        </div>
      </motion.header>

      <Dialog open={statsMonthPickerOpen} onOpenChange={setStatsMonthPickerOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih Bulan</DialogTitle>
            <DialogDescription>Pilih bulan untuk ringkasan keuangan.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {months.map((month, index) => (
              <Button
                key={month}
                type="button"
                variant={statsMonth === month ? 'default' : 'outline'}
                aria-label={month}
                onClick={() => {
                  setStatsMonth(month);
                  setStatsMonthPickerOpen(false);
                }}
              >
                {monthShortNames[index]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <motion.section
        initial={revealInitial}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(270px,.8fr)]"
        aria-label="Ringkasan keuangan"
        aria-busy={statsLoading}
      >
        <div className="min-w-0 rounded-xl border border-border/80 bg-background p-5 sm:p-7">
          {error && <p role="alert" className="mb-5 text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Uang terkumpul</p>
              <Link
                href={recapHref}
                className="group mt-2 inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Buka rekap bulanan ${statsMonth ?? ''} ${statsYear ?? ''}`}
              >
                <p aria-live="polite" className="text-3xl font-semibold leading-tight tracking-tight tabular-nums group-hover:text-primary sm:text-[38px]">
                  {statsLoading ? 'Memuat...' : stats ? formatRupiah(stats.totalRevenue) : '-'}
                </p>
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{statsMonth ?? '...'} {statsYear ?? ''}</p>
            </div>
            <div className="min-w-[72px] text-right">
              <p className="text-3xl font-medium tabular-nums text-primary">
                {statsLoading ? '...' : stats ? `${collectedPercent}%` : '-'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">tertagih</p>
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="Progres pembayaran tagihan"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stats ? collectedPercent : 0}
            className="mt-6 h-2 overflow-hidden rounded-full bg-primary/10"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-primary"
              initial={prefersReducedMotion ? false : { scaleX: 0 }}
              animate={{ scaleX: collectedPercent / 100 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-border/70 pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Nilai seluruh tagihan</p>
              <p className="mt-1.5 text-sm font-medium tabular-nums">
                {statsLoading ? 'Memuat...' : stats ? formatRupiah(stats.totalDue) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tagihan lunas</p>
              <p className="mt-1.5 text-sm font-medium tabular-nums">
                {statsLoading ? '-' : stats?.paidBillings ?? '-'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Tagihan dicicil</p>
              <p className="mt-1.5 text-sm font-medium tabular-nums">
                {statsLoading ? '-' : stats?.installmentBillings ?? '-'}
              </p>
            </div>
          </div>
        </div>

        <aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/[0.045] p-4 sm:p-5 xl:flex-col xl:items-start xl:justify-start" aria-labelledby="follow-up-heading">
          <div className="min-w-0">
            <h2 id="follow-up-heading" className="text-sm font-medium">Sisa yang perlu dikumpulkan</h2>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-xl font-semibold tracking-tight tabular-nums">
                {statsLoading ? 'Memuat...' : stats ? formatRupiah(stats.outstandingAmount) : '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? 'Menghitung tagihan' : stats ? `${stats.unpaidBillings} belum lunas` : 'Data tidak tersedia'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={unpaidHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-primary/25 bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Tinjau tagihan
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/collector" className="hidden items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              Setoran
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </motion.section>

      <motion.section
        initial={revealInitial}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        aria-label="Angka operasional"
        aria-busy={statsLoading}
      >
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 border-y border-border/70 py-5 sm:grid-cols-4">
          <Link href="/customers/all" className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-xs text-muted-foreground">Pelanggan aktif</p>
            <p className="mt-1.5 text-2xl font-medium tabular-nums group-hover:text-primary">
              {statsLoading ? '-' : stats?.totalCustomers ?? '-'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">saat ini</p>
          </Link>
          <Link href="/archived" className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-xs text-muted-foreground">Pelanggan arsip</p>
            <p className="mt-1.5 text-2xl font-medium tabular-nums group-hover:text-primary">
              {statsLoading ? '-' : stats?.archivedCustomers ?? '-'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">tidak aktif</p>
          </Link>
          <Link href={recapHref} className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-xs text-muted-foreground">Tagihan diterbitkan</p>
            <p className="mt-1.5 text-2xl font-medium tabular-nums group-hover:text-primary">
              {statsLoading ? '-' : stats?.totalBillings ?? '-'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">periode terpilih</p>
          </Link>
          <Link href={unpaidCustomersHref} className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-xs text-muted-foreground">Belum bayar</p>
            <p className="mt-1.5 text-2xl font-medium tabular-nums group-hover:text-primary">
              {statsLoading ? '-' : stats?.unpaidCustomers ?? '-'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">pelanggan periode ini</p>
          </Link>
        </div>
      </motion.section>

      <motion.section
        initial={revealInitial}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="space-y-4"
        aria-labelledby="customer-list-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="customer-list-heading" className="text-lg font-semibold">Pelanggan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Buka profil atau cari berdasarkan nama dan alamat.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Cari nama atau alamat..."
              aria-label="Cari pelanggan berdasarkan nama atau alamat"
              className="pl-9"
            />
          </div>
        </div>

        {customersError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border/70 py-5">
            <p role="alert" className="text-sm text-destructive">{customersError}</p>
            <Button type="button" variant="outline" size="sm" onClick={refreshDashboard}>Coba lagi</Button>
          </div>
        ) : customersLoading ? (
          <div className="flex items-center justify-center gap-2 border-y border-border/70 py-8 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4" aria-hidden="true" /> Memuat pelanggan...
          </div>
        ) : visibleCustomers.length === 0 ? (
          <p className="border-y border-border/70 py-8 text-center text-sm text-muted-foreground">
            {normalizedCustomerSearch ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada pelanggan aktif.'}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <p aria-live="polite">
                {normalizedCustomerSearch
                  ? `${matchingCustomers.length} hasil pencarian`
                  : `${Math.min(customers.length, 6)} dari ${customers.length} pelanggan aktif`}
              </p>
              {!normalizedCustomerSearch && (
                <Link href="/customers/all" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
                  Semua pelanggan <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
            <ul className="divide-y divide-border/70 border-y border-border/70">
              {visibleCustomers.map((customer) => {
                const billingStatus = billingStatusByCustomer.get(customer._id);
                const isPaid = ['TF', 'Cash', 'Lunas'].includes(billingStatus ?? '');
                const statusLabel = !stats ? null : billingStatus
                  ? isPaid ? 'Lunas' : billingStatus === 'Nyicil' ? 'Nyicil' : billingStatus === 'Belum Bayar' ? 'Belum bayar' : billingStatus
                  : 'Baru';
                const statusClass = isPaid
                  ? 'border-emerald-700/15 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300'
                  : billingStatus === 'Nyicil'
                    ? 'border-amber-700/15 bg-amber-600/10 text-amber-800 dark:text-amber-300'
                    : billingStatus === 'Belum Bayar'
                      ? 'border-destructive/15 bg-destructive/10 text-destructive'
                      : 'border-border text-muted-foreground';

                return (
                  <li key={customer._id}>
                    <Link
                      href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
                      className="group grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium group-hover:text-primary">{customer.name}</span>
                          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                          </span>
                        </span>
                      </div>
                      <span className="hidden min-w-32 text-xs text-muted-foreground sm:block">
                        {customer.packageId ? `${customer.packageId.name} · ${customer.packageId.speed}` : 'Paket belum dipilih'}
                        <span className="mt-1 flex items-center gap-1">
                          {customer.createdAt && <CalendarDays className="h-3 w-3" aria-hidden="true" />}
                          {customer.createdAt ? formatDateTime(customer.createdAt) : customer.createdBy || 'Admin'}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {statusLabel && <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>}
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </motion.section>
    </div>
  );
}

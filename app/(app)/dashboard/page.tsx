'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, MapPin, Search, CalendarDays, UserRound, ChevronRight, ArrowUpRight, UserPlus, WalletCards } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  }, []);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDateTime = (value?: string) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase('id-ID');
  const matchingCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.address || ''}`.toLocaleLowerCase('id-ID').includes(normalizedCustomerSearch)
  );
  const visibleCustomers = normalizedCustomerSearch ? matchingCustomers : matchingCustomers.slice(0, 10);
  const collectedPercent = stats && stats.totalDue > 0
    ? Math.min(100, Math.round((stats.totalRevenue / stats.totalDue) * 100))
    : 0;
  const statCards = [
    {
      title: 'Pelanggan Aktif',
      value: stats?.totalCustomers ?? 0,
      description: 'Pelanggan terdaftar',
      href: '/customers/all',
    },
    {
      title: 'Pelanggan Arsip',
      value: stats?.archivedCustomers ?? 0,
      description: 'Pelanggan masuk arsip',
      href: '/archived',
    },
    {
      title: 'Total Tagihan',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.totalDue ?? 0),
      description: `${statsLoading ? 'Mengambil' : stats?.totalBillings ?? 0} tagihan`,
    },
    {
      title: 'Uang Terkumpul',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.totalRevenue ?? 0),
      description: `Pembayaran ${statsMonth} ${statsYear}`,
      href: `/dashboard/billings/paid?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`,
    },
    {
      title: 'Sisa Belum Lunas',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.outstandingAmount ?? 0),
      description: `${statsLoading ? 'Menghitung' : stats?.unpaidBillings ?? 0} tagihan`,
      href: `/dashboard/billings/unpaid?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`,
    },
    {
      title: 'Belum Bayar',
      value: statsLoading ? 'Memuat...' : stats?.unpaidCustomers ?? 0,
      description: 'Pelanggan pada periode',
      href: `/dashboard/billings/belum-bayar?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`,
    },
  ];

  return (
    <div className="space-y-7 sm:space-y-9">
      <header className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ikhtisar tagihan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kinerja pembayaran pelanggan WiFi</p>
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
          {statsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Memuat statistik" />}
          <Button asChild className="w-full gap-2 sm:w-auto">
            <Link href="/billing/add"><UserPlus className="h-4 w-4" />Tambah pelanggan</Link>
          </Button>
        </div>
      </header>

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

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(260px,.85fr)]" aria-label="Ringkasan keuangan" aria-busy={statsLoading}>
        <Card className="border-border/70">
          <CardContent className="space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Uang terkumpul</p>
                <p className="mt-2 text-3xl font-semibold leading-none tabular-nums sm:text-4xl">
                  {statsLoading ? 'Memuat...' : formatRupiah(stats?.totalRevenue ?? 0)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">dari {formatRupiah(stats?.totalDue ?? 0)} tagihan periode ini</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{collectedPercent}%</p>
                <p className="text-xs text-muted-foreground">terbayar</p>
              </div>
            </div>
            <div
              role="progressbar"
              aria-label="Progres pembayaran tagihan"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={collectedPercent}
              className="h-2 overflow-hidden rounded-full bg-muted"
            >
              <motion.div
                className="h-full origin-left rounded-full bg-[hsl(var(--chart-1))]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: collectedPercent / 100 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-border/70 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Total tagihan</p>
                <p className="mt-1 text-sm font-medium tabular-nums">{formatRupiah(stats?.totalDue ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sisa belum lunas</p>
                <p className="mt-1 text-sm font-medium tabular-nums">{formatRupiah(stats?.outstandingAmount ?? 0)}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Belum bayar</p>
                <p className="mt-1 text-sm font-medium tabular-nums">{stats?.unpaidCustomers ?? 0} pelanggan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-2" aria-labelledby="follow-up-heading">
          <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
            <h2 id="follow-up-heading" className="text-base font-semibold">Tindak lanjut</h2>
            <span className="text-xs text-muted-foreground">{statsLoading ? 'Memuat' : `${stats?.unpaidCustomers ?? 0} pelanggan belum bayar`}</span>
          </div>
          <Link href={`/dashboard/billings/unpaid?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`} className="group flex items-center justify-between gap-3 rounded-md border border-border/70 p-3.5 transition-colors hover:bg-muted/50">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Periksa tagihan tertunggak</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{stats?.unpaidBillings ?? 0} tagihan belum selesai</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
          <Link href="/collector" className="group flex items-center justify-between gap-3 rounded-md border border-border/70 p-3.5 transition-colors hover:bg-muted/50">
            <span className="min-w-0">
              <span className="block text-sm font-medium">Buka setoran harian</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Catat kunjungan dan pembayaran</span>
            </span>
            <WalletCards className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </section>
      </section>

      <section aria-labelledby="period-numbers-heading" aria-busy={statsLoading}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="period-numbers-heading" className="text-base font-semibold">Angka periode</h2>
          <span className="text-xs text-muted-foreground">{statsMonth ?? '...'} {statsYear ?? ''}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-md bg-muted/30 p-4 sm:grid-cols-3 sm:gap-y-6 lg:grid-cols-6">
          {statCards.map((stat) => {
            const value = (
              <>
                <span className="block text-xs text-muted-foreground">{stat.title}</span>
                <span className="mt-1.5 block break-words text-sm font-semibold leading-tight tabular-nums sm:text-base">{stat.value}</span>
                <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{stat.description}</span>
              </>
            );
            return stat.href ? (
              <Link key={stat.title} href={stat.href} className="group min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="group-hover:text-primary">{value}</span>
              </Link>
            ) : <div key={stat.title} className="min-w-0">{value}</div>;
          })}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="recent-customers-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="recent-customers-heading" className="text-base font-semibold">Pelanggan terbaru</h2>
            <p className="mt-1 text-xs text-muted-foreground">Akses cepat ke informasi dan status tagihan</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          <p role="alert" className="text-sm text-destructive">{customersError}</p>
        ) : customersLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat pelanggan...
          </div>
        ) : visibleCustomers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {normalizedCustomerSearch ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada pelanggan aktif.'}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {normalizedCustomerSearch
                ? `${matchingCustomers.length} hasil pencarian, menampilkan ${visibleCustomers.length}`
                : `${Math.min(customers.length, 10)} dari ${customers.length} pelanggan aktif`}
            </p>
            <ul className="space-y-2">
              {visibleCustomers.map((customer) => (
                <li key={customer._id}>
                  <Link
                    href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
                    className="group block animate-fade-in"
                  >
                    <Card className="cursor-pointer border-border/60 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/30">
                      <CardContent className="py-3">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                              {customer.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold">{customer.name}</p>
                              <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" /> {formatDateTime(customer.createdAt)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="h-3 w-3" /> {customer.createdBy || 'Admin'}
                                </span>
                                {customer.packageId && <span>{customer.packageId.name} · {customer.packageId.speed}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                            <div className="flex gap-1.5">
                              {stats?.billingStatuses.some((billing) => billing.customerId === customer._id && ['TF', 'Cash', 'Lunas'].includes(billing.status)) && (
                                <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">Lunas</Badge>
                              )}
                              {stats?.billingStatuses.some((billing) => billing.customerId === customer._id && billing.status === 'Nyicil') && (
                                <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15">Nyicil</Badge>
                              )}
                              {stats?.billingStatuses.some((billing) => billing.customerId === customer._id && billing.status === 'Belum Bayar') && (
                                <Badge className="border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/15">Belum Bayar</Badge>
                              )}
                              {stats && !stats.billingStatuses.some((billing) => billing.customerId === customer._id) && (
                                <Badge variant="outline" className="text-muted-foreground">Baru</Badge>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

    </div>
  );
}

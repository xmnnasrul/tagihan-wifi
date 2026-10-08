'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Loader2, FileText, Wallet, AlertCircle, Archive, Clock3, MapPin, Search, CalendarDays, UserRound, ChevronRight } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';

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
const progressChartConfig = {
  progress: { label: 'Persentase Terkumpul', color: '#4ade80' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [statsMonth, setStatsMonth] = useState<string | null>(null);
  const [statsMonthPickerOpen, setStatsMonthPickerOpen] = useState(false);
  const [statsYear, setStatsYear] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [monthlyBillingsReady, setMonthlyBillingsReady] = useState(false);
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
    let isCurrentRequest = true;
    async function ensureCurrentMonthBillings() {
      try {
        const response = await fetch('/api/billings/generate-month', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Gagal membuat tagihan bulan ini');
      } catch (err) {
        if (isCurrentRequest) setError(err instanceof Error ? err.message : 'Gagal membuat tagihan bulan ini');
      } finally {
        if (isCurrentRequest) setMonthlyBillingsReady(true);
      }
    }
    void ensureCurrentMonthBillings();
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  useEffect(() => {
    const month = statsMonth;
    const year = statsYear;
    if (!monthlyBillingsReady || !month || !year) return;
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
  }, [monthlyBillingsReady, statsMonth, statsYear]);

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
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      href: '/customers/all',
    },
    {
      title: 'Pelanggan Arsip',
      value: stats?.archivedCustomers ?? 0,
      description: 'Pelanggan masuk arsip',
      icon: Archive,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      href: '/archived',
    },
    {
      title: 'Total Tagihan',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.totalDue ?? 0),
      description: `${statsLoading ? 'Mengambil' : stats?.totalBillings ?? 0} tagihan`,
      icon: FileText,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
    },
    {
      title: 'Uang Terkumpul',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.totalRevenue ?? 0),
      description: `Pembayaran ${statsMonth} ${statsYear}`,
      icon: Wallet,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      href: `/dashboard/billings/paid?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`,
    },
    {
      title: 'Sisa Belum Lunas',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.outstandingAmount ?? 0),
      description: `${statsLoading ? 'Menghitung' : stats?.unpaidBillings ?? 0} tagihan`,
      icon: AlertCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      href: `/dashboard/billings/unpaid?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`,
    },
    {
      title: 'Belum Bayar',
      value: statsLoading ? 'Memuat...' : stats?.unpaidCustomers ?? 0,
      description: 'Pelanggan pada periode',
      icon: Clock3,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      href: `/dashboard/billings/belum-bayar?month=${encodeURIComponent(statsMonth ?? '')}&year=${statsYear ?? ''}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan dan kelola tagihan pelanggan WiFi</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium">Periode Keuangan</p>
          <p className="text-xs text-muted-foreground mt-1">Pilih bulan untuk memperbarui ringkasan tagihan.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-[150px] justify-between font-normal"
            aria-label="Pilih bulan periode keuangan"
            onClick={() => setStatsMonthPickerOpen(true)}
          >
            {statsMonth ?? 'Memuat...'}
            <span className="text-xs text-muted-foreground">Pilih</span>
          </Button>
          <Select value={statsYear ?? ''} onValueChange={setStatsYear}>
            <SelectTrigger className="w-[110px]" aria-label="Tahun periode keuangan">
              <SelectValue placeholder="..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, index) => 2026 + index).map((year) => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Memuat statistik" />}
        </div>
      </div>

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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-busy={statsLoading}>
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          const card = (
            <Card className={cn(
              'border-border/60 transition-colors',
              stat.href && 'hover:border-border'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold mt-2 tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </div>
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', stat.bg)}>
                    <Icon className={cn('h-5 w-5', stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link
              key={i}
              href={stat.href}
              className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {card}
            </Link>
          ) : <div key={i}>{card}</div>;
        })}
      </div>

      <Card className="border-border/60">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-lg font-semibold">Progres Pembayaran Tagihan</h2>
            <p className="mt-1 text-xs text-muted-foreground">{statsMonth ?? '...'} {statsYear ?? ''} · Persentase tagihan yang sudah terkumpul</p>
          </div>
          {statsLoading ? (
            <div className="flex h-[300px] items-center justify-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat grafik...
            </div>
          ) : !stats || stats.totalDue === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Belum ada tagihan pada {statsMonth} {statsYear}.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr),220px]">
                  <div className="relative mx-auto h-[280px] w-full max-w-[360px]">
                    <ChartContainer config={progressChartConfig} className="h-full w-full aspect-auto" aria-label={`Progres pembayaran ${collectedPercent} persen`}>
                      <RadialBarChart data={[{ name: 'Terkumpul', progress: collectedPercent }]} innerRadius="72%" outerRadius="96%" startAngle={90} endAngle={-270}>
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar dataKey="progress" cornerRadius={12} background fill="var(--color-progress)" />
                      </RadialBarChart>
                    </ChartContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-bold tabular-nums">{collectedPercent}%</span>
                      <span className="text-xs text-muted-foreground">sudah terkumpul</span>
                    </div>
                  </div>
                  <dl className="grid gap-3 text-sm">
                    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Total tagihan</dt>
                      <dd className="font-medium">{formatRupiah(stats.totalDue)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Terkumpul</dt>
                      <dd className="font-medium text-emerald-400">{formatRupiah(stats.totalRevenue)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">Belum dibayar</dt>
                      <dd className="font-medium text-rose-400">{formatRupiah(stats.outstandingAmount)}</dd>
                    </div>
                  </dl>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4" aria-label="Daftar pelanggan">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Cari nama atau alamat pelanggan..."
            aria-label="Cari pelanggan berdasarkan nama atau alamat"
            className="pl-9"
          />
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
            <ul className="mx-auto w-[96%] space-y-2">
              {visibleCustomers.map((customer) => (
                <li key={customer._id}>
                  <Link
                    href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
                    className="group block animate-fade-in"
                  >
                    <Card className="cursor-pointer border-border/60 transition-all duration-200 hover:border-primary/40 hover:bg-accent/30">
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
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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

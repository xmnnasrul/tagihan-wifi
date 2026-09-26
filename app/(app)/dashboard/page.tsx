'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Users, ChevronRight, Loader2, Wifi, MapPin, CalendarDays, UserRound, FileText, Wallet, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Stats {
  totalCustomers: number;
  totalBillings: number;
  paidBillings: number;
  unpaidBillings: number;
  installmentBillings: number;
  totalDue: number;
  outstandingAmount: number;
  totalRevenue: number;
  totalAllRevenue: number;
  currentMonth: string;
  currentYear: number;
}

interface Customer {
  _id: string;
  name: string;
  address: string;
  packageId: { _id: string; name: string; price: number; speed: string } | null;
  createdAt?: string;
  createdBy?: string;
}

interface BillingSummary {
  status: string;
  month: string;
}

type StatusFilter = 'all' | 'lunas' | 'nyicil';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [billings, setBillings] = useState<Record<string, BillingSummary[]>>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billingMonthFilter, setBillingMonthFilter] = useState<string>('all');
  const [billingMonthPickerOpen, setBillingMonthPickerOpen] = useState(false);
  const [statsMonth, setStatsMonth] = useState(months[new Date().getMonth()]);
  const [statsMonthPickerOpen, setStatsMonthPickerOpen] = useState(false);
  const [statsYear, setStatsYear] = useState(String(new Date().getFullYear()));
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let isCurrentRequest = true;
    async function fetchStats() {
      setStatsLoading(true);
      setStats(null);
      try {
        const params = new URLSearchParams({ month: statsMonth, year: statsYear });
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
  }, [statsMonth, statsYear]);

  useEffect(() => {
    async function fetchData() {
      try {
        const customersRes = await fetch('/api/customers');
        const customersData = await customersRes.json();
        if (!customersRes.ok || !Array.isArray(customersData)) {
          throw new Error(customersData.error || 'Gagal memuat data pelanggan');
        }
        setCustomers(customersData);

        const billingPromises = customersData.map((c: Customer) =>
          fetch(`/api/billings?customerName=${encodeURIComponent(c.name)}`).then((r) => r.json())
        );
        const billingResults = await Promise.all(billingPromises);
        const billingMap: Record<string, BillingSummary[]> = {};
        customersData.forEach((c: Customer, i: number) => {
          billingMap[c.name] = Array.isArray(billingResults[i])
            ? billingResults[i].map((b: BillingSummary) => ({ status: b.status, month: b.month }))
            : [];
        });
        setBillings(billingMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const searchableText = `${c.name} ${c.address ?? ''} ${c.packageId?.name ?? ''} ${c.packageId?.speed ?? ''}`.toLowerCase();
      const matchesSearch = searchableText.includes(debouncedSearch.toLowerCase());

      const allStatuses = billings[c.name] || [];
      const statuses = billingMonthFilter === 'all'
        ? allStatuses
        : allStatuses.filter((billing) => billing.month === billingMonthFilter);
      const hasPaid = statuses.some((billing) => billing.status === 'TF' || billing.status === 'Cash' || billing.status === 'Lunas');
      const hasInstallment = statuses.some((billing) => billing.status === 'Nyicil');
      const hasSelectedMonth = billingMonthFilter === 'all' || statuses.length > 0;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'lunas' && hasPaid) ||
        (statusFilter === 'nyicil' && hasInstallment);

      return matchesSearch && matchStatus && hasSelectedMonth;
    });
  }, [customers, debouncedSearch, statusFilter, billingMonthFilter, billings]);

  const visibleCustomers = debouncedSearch ? filteredCustomers : filteredCustomers.slice(0, 20);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDateTime = (value?: string) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

  if (loading) {
    return (
      <div className="space-y-6" aria-label="Memuat dashboard">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-24 animate-pulse rounded-xl bg-card" />
        <div className="h-20 animate-pulse rounded-xl bg-card" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Pelanggan Aktif',
      value: stats?.totalCustomers ?? 0,
      description: 'Pelanggan berjalan',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Total Tagihan',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.totalDue ?? 0),
      description: `${statsLoading ? 'Mengambil' : stats?.totalBillings ?? 0} tagihan ${statsMonth} ${statsYear}`,
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
    },
    {
      title: 'Sisa Belum Lunas',
      value: statsLoading ? 'Memuat...' : formatRupiah(stats?.outstandingAmount ?? 0),
      description: `${statsLoading ? 'Menghitung' : stats?.unpaidBillings ?? 0} tagihan belum lunas`,
      icon: AlertCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
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
            {statsMonth}
            <span className="text-xs text-muted-foreground">Pilih</span>
          </Button>
          <Select value={statsYear} onValueChange={setStatsYear}>
            <SelectTrigger className="w-[110px]" aria-label="Tahun periode keuangan">
              <SelectValue />
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
        <DialogContent className="sm:max-w-sm">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={statsLoading}>
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-border/60 hover:border-border transition-colors">
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
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, alamat, atau paket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Bulan</span>
            <Button type="button" variant="outline" className="w-[150px] justify-between font-normal" onClick={() => setBillingMonthPickerOpen(true)}>
              {billingMonthFilter === 'all' ? 'Semua Bulan' : billingMonthFilter}
              <span className="text-xs text-muted-foreground">Pilih</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="lunas">Lunas</SelectItem>
                <SelectItem value="nyicil">Nyicil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Dialog open={billingMonthPickerOpen} onOpenChange={setBillingMonthPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Filter Bulan Tagihan</DialogTitle>
            <DialogDescription>Tampilkan pelanggan yang memiliki tagihan pada bulan tertentu.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <Button type="button" variant={billingMonthFilter === 'all' ? 'default' : 'outline'} onClick={() => {
              setBillingMonthFilter('all');
              setBillingMonthPickerOpen(false);
            }}>
              Semua
            </Button>
            {months.map((month, index) => (
              <Button key={month} type="button" variant={billingMonthFilter === month ? 'default' : 'outline'} onClick={() => {
                setBillingMonthFilter(month);
                setBillingMonthPickerOpen(false);
              }}>
                {monthShortNames[index]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer list */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {search.trim()
            ? `${visibleCustomers.length} hasil pencarian`
            : `Menampilkan ${visibleCustomers.length} dari ${filteredCustomers.length} pelanggan`}
        </p>
        {visibleCustomers.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Wifi className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {search ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Belum ada pelanggan. Tambahkan tagihan untuk memulai.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          visibleCustomers.map((customer, index) => {
            const statuses = billings[customer.name] || [];
            const hasPaid = statuses.some((billing) => billing.status === 'TF' || billing.status === 'Cash' || billing.status === 'Lunas');
            const hasInstallment = statuses.some((billing) => billing.status === 'Nyicil');

            return (
              <Link
                key={customer._id}
                href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
                className="block group animate-fade-in"
                style={{ animationDelay: `${Math.min(index, 9) * 35}ms` }}
              >
                <Card className="border-border/60 hover:border-primary/40 hover:bg-accent/30 transition-all duration-200 cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate text-base">{customer.name}</p>
                          <div className="flex items-start gap-1.5 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDateTime(customer.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3 w-3" />
                              {customer.createdBy || 'Admin'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 flex-shrink-0 sm:justify-end">
                        <div className="flex gap-1.5">
                          {hasPaid && <Badge variant="default" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">Lunas</Badge>}
                          {hasInstallment && <Badge variant="default" className="bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/15">Nyicil</Badge>}
                          {!hasPaid && !hasInstallment && statuses.length > 0 && (
                            <Badge variant="default" className="bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/15">Belum Bayar</Badge>
                          )}
                          {statuses.length === 0 && (
                            <Badge variant="outline" className="text-muted-foreground">Baru</Badge>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

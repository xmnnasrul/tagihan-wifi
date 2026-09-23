'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Users, FileText, DollarSign, TrendingUp, ArrowUpDown, Download, ChevronRight, Loader2, Wifi } from 'lucide-react';
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

interface Stats {
  totalCustomers: number;
  totalBillings: number;
  paidBillings: number;
  installmentBillings: number;
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
}

type SortBy = 'name-asc' | 'name-desc' | 'status-paid' | 'status-unpaid';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [billings, setBillings] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name-asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportMonth, setExportMonth] = useState<string>('all');
  const [exportYear, setExportYear] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, customersRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/customers'),
        ]);
        const statsData = await statsRes.json();
        const customersData = await customersRes.json();
        if (!statsRes.ok) throw new Error(statsData.error || 'Gagal memuat statistik');
        if (!customersRes.ok || !Array.isArray(customersData)) {
          throw new Error(customersData.error || 'Gagal memuat data pelanggan');
        }
        setStats(statsData);
        setCustomers(customersData);

        const billingPromises = customersData.map((c: Customer) =>
          fetch(`/api/billings?customerName=${encodeURIComponent(c.name)}`).then((r) => r.json())
        );
        const billingResults = await Promise.all(billingPromises);
        const billingMap: Record<string, string[]> = {};
        customersData.forEach((c: Customer, i: number) => {
          billingMap[c.name] = Array.isArray(billingResults[i])
            ? billingResults[i].map((b: { status: string }) => b.status)
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

  const filteredAndSorted = useMemo(() => {
    let result = customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    if (sortBy === 'name-asc') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name-desc') {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'status-paid') {
      result = [...result].sort((a, b) => {
        const aPaid = (billings[a.name] || []).some((s) => s === 'TF' || s === 'Cash') ? 1 : 0;
        const bPaid = (billings[b.name] || []).some((s) => s === 'TF' || s === 'Cash') ? 1 : 0;
        return bPaid - aPaid;
      });
    } else if (sortBy === 'status-unpaid') {
      result = [...result].sort((a, b) => {
        const aPaid = (billings[a.name] || []).some((s) => s === 'TF' || s === 'Cash') ? 1 : 0;
        const bPaid = (billings[b.name] || []).some((s) => s === 'TF' || s === 'Cash') ? 1 : 0;
        return aPaid - bPaid;
      });
    }

    return result;
  }, [customers, search, sortBy, billings]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (exportMonth !== 'all') params.set('month', exportMonth);
    if (exportYear !== 'all') params.set('year', exportYear);
    window.open(`/api/billings/export?${params.toString()}`, '_blank');
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Pelanggan',
      value: stats?.totalCustomers ?? 0,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan dan kelola tagihan pelanggan WiFi</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-border/60 hover:border-border transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.title}</p>
                    <p className="text-2xl font-bold mt-2 tracking-tight">{stat.value}</p>
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

      {/* Export section */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Ekspor Data Tagihan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Bulan</label>
              <Select value={exportMonth} onValueChange={setExportMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Semua Bulan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Bulan</SelectItem>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tahun</label>
              <Select value={exportYear} onValueChange={setExportYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Ekspor CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama pelanggan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nama (A-Z)</SelectItem>
              <SelectItem value="name-desc">Nama (Z-A)</SelectItem>
              <SelectItem value="status-paid">Sudah Bayar</SelectItem>
              <SelectItem value="status-unpaid">Belum Bayar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        {filteredAndSorted.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Wifi className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {search ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Belum ada pelanggan. Tambahkan tagihan untuk memulai.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAndSorted.map((customer) => {
            const statuses = billings[customer.name] || [];
            const hasPaid = statuses.some((s) => s === 'TF' || s === 'Cash');
            const hasInstallment = statuses.some((s) => s === 'Nyicil');
            const pkg = customer.packageId;

            return (
              <Link
                key={customer._id}
                href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
                className="block group"
              >
                <Card className="border-border/60 hover:border-primary/40 hover:bg-accent/30 transition-all duration-200 cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{customer.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {pkg ? (
                              <span className="text-xs text-muted-foreground">{pkg.name} - {pkg.speed}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Tidak ada paket</span>
                            )}
                            {customer.address && (
                              <span className="text-xs text-muted-foreground hidden sm:inline">- {customer.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
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

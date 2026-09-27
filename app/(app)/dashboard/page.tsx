'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Loader2, FileText, Wallet, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
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

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const statCards = [
    {
      title: 'Pelanggan Aktif',
      value: stats?.totalCustomers ?? 0,
      description: 'Lihat semua pelanggan',
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
          const card = (
            <Card className={cn(
              'border-border/60 hover:border-border transition-colors',
              stat.title === 'Pelanggan Aktif' && 'cursor-pointer'
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
          return stat.title === 'Pelanggan Aktif' ? (
            <Link key={i} href="/customers" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              {card}
            </Link>
          ) : <div key={i}>{card}</div>;
        })}
      </div>

    </div>
  );
}

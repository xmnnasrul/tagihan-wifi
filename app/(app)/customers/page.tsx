'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronRight, Loader2, MapPin, Search, UserRound, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [billings, setBillings] = useState<Record<string, BillingSummary[]>>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [billingMonthFilter, setBillingMonthFilter] = useState('all');
  const [billingMonthPickerOpen, setBillingMonthPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const response = await fetch('/api/customers');
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data.error || 'Gagal memuat data pelanggan');
        }

        setCustomers(data);
        const billingResults = await Promise.all(
          data.map((customer: Customer) =>
            fetch(`/api/billings?customerName=${encodeURIComponent(customer.name)}`).then((result) => result.json())
          )
        );
        const billingMap: Record<string, BillingSummary[]> = {};
        data.forEach((customer: Customer, index: number) => {
          billingMap[customer.name] = Array.isArray(billingResults[index])
            ? billingResults[index].map((billing: BillingSummary) => ({ status: billing.status, month: billing.month }))
            : [];
        });
        setBillings(billingMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data pelanggan');
      } finally {
        setLoading(false);
      }
    }
    void fetchCustomers();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const searchableText = `${customer.name} ${customer.address ?? ''} ${customer.packageId?.name ?? ''} ${customer.packageId?.speed ?? ''}`.toLowerCase();
    const matchesSearch = searchableText.includes(debouncedSearch.toLowerCase());
    const allStatuses = billings[customer.name] || [];
    const statuses = billingMonthFilter === 'all'
      ? allStatuses
      : allStatuses.filter((billing) => billing.month === billingMonthFilter);
    const hasPaid = statuses.some((billing) => billing.status === 'TF' || billing.status === 'Cash' || billing.status === 'Lunas');
    const hasInstallment = statuses.some((billing) => billing.status === 'Nyicil');
    const hasSelectedMonth = billingMonthFilter === 'all' || statuses.length > 0;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'lunas' && hasPaid)
      || (statusFilter === 'nyicil' && hasInstallment);

    return matchesSearch && matchesStatus && hasSelectedMonth;
  }), [customers, debouncedSearch, statusFilter, billingMonthFilter, billings]);

  const formatDateTime = (value?: string) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pelanggan Aktif</h1>
          <p className="mt-1 text-sm text-muted-foreground">Daftar seluruh pelanggan aktif</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, alamat, atau paket..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Bulan</span>
            <Button type="button" variant="outline" className="w-[150px] justify-between font-normal" onClick={() => setBillingMonthPickerOpen(true)}>
              {billingMonthFilter === 'all' ? 'Semua Bulan' : billingMonthFilter}
              <span className="text-xs text-muted-foreground">Pilih</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status</span>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
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

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {debouncedSearch
            ? `${filteredCustomers.length} hasil pencarian`
            : `Menampilkan ${filteredCustomers.length} dari ${customers.length} pelanggan`}
        </p>
        {filteredCustomers.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Wifi className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                {debouncedSearch ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : 'Belum ada pelanggan aktif.'}
              </p>
            </CardContent>
          </Card>
        ) : filteredCustomers.map((customer, index) => {
          const statuses = billings[customer.name] || [];
          const hasPaid = statuses.some((billing) => billing.status === 'TF' || billing.status === 'Cash' || billing.status === 'Lunas');
          const hasInstallment = statuses.some((billing) => billing.status === 'Nyicil');

          return (
            <Link
              key={customer._id}
              href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
              className="group block animate-fade-in"
              style={{ animationDelay: `${Math.min(index, 9) * 35}ms` }}
            >
              <Card className="cursor-pointer border-border/60 transition-all duration-200 hover:border-primary/40 hover:bg-accent/30">
                <CardContent className="py-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{customer.name}</p>
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
                    <div className="flex flex-shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <div className="flex gap-1.5">
                        {hasPaid && <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">Lunas</Badge>}
                        {hasInstallment && <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15">Nyicil</Badge>}
                        {!hasPaid && !hasInstallment && statuses.length > 0 && (
                          <Badge className="border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/15">Belum Bayar</Badge>
                        )}
                        {statuses.length === 0 && <Badge variant="outline" className="text-muted-foreground">Baru</Badge>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
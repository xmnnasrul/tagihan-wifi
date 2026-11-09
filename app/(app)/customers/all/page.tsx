'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Loader2, MapPin, Search, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Customer {
  _id: string;
  name: string;
  address: string;
  packageId: { _id: string; name: string; price: number; speed: string } | null;
  status: 'active' | 'inactive';
  archivedAt: string | null;
  createdAt?: string;
  createdBy?: string;
}

interface BillingSummary {
  customerId: string;
  status: string;
  month: string;
  year: number;
  createdAt: string;
}

type StatusFilter = 'all' | 'belum-bayar' | 'lunas-cash' | 'lunas-tf' | 'nyicil';

export default function AllCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [billings, setBillings] = useState<Record<string, Omit<BillingSummary, 'customerId'>[]>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrentRequest = true;
    async function fetchCustomers() {
      try {
        const [customersResponse, billingsResponse] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/billings?summary=true'),
        ]);
        const [customerData, billingData] = await Promise.all([
          customersResponse.json(),
          billingsResponse.json(),
        ]);
        if (!customersResponse.ok || !Array.isArray(customerData)) {
          throw new Error(customerData.error || 'Gagal memuat data pelanggan');
        }
        if (!billingsResponse.ok || !Array.isArray(billingData)) {
          throw new Error(billingData.error || 'Gagal memuat ringkasan tagihan');
        }
        if (isCurrentRequest) {
          setCustomers(customerData);
          const billingMap: Record<string, Omit<BillingSummary, 'customerId'>[]> = {};
          (billingData as BillingSummary[]).forEach((billing) => {
            (billingMap[billing.customerId] ||= []).push({
              status: billing.status,
              month: billing.month,
              year: billing.year,
              createdAt: billing.createdAt,
            });
          });
          setBillings(billingMap);
        }
      } catch (fetchError) {
        if (isCurrentRequest) {
          setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat data pelanggan');
        }
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    }
    void fetchCustomers();
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => customers.filter((customer) => {
    const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
    const searchableText = `${customer.name} ${customer.address || ''} ${customer.packageId?.name || ''} ${customer.packageId?.speed || ''}`;
    const matchesSearch = searchableText.toLocaleLowerCase('id-ID').includes(normalizedSearch);
    const matchingBillings = billings[customer._id] || [];
    const hasPaidCash = matchingBillings.some((billing) => billing.status === 'Cash');
    const hasPaidTf = matchingBillings.some((billing) => billing.status === 'TF');
    const hasInstallment = matchingBillings.some((billing) => billing.status === 'Nyicil');
    const hasUnpaid = matchingBillings.some((billing) => billing.status === 'Belum Bayar');
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'belum-bayar' && hasUnpaid)
      || (statusFilter === 'lunas-cash' && hasPaidCash)
      || (statusFilter === 'lunas-tf' && hasPaidTf)
      || (statusFilter === 'nyicil' && hasInstallment);

    return matchesSearch && matchesStatus;
  }), [customers, billings, search, statusFilter]);

  const hasActiveFilters = statusFilter !== 'all';

  const formatDateTime = (value?: string | null) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, alamat, atau paket..."
            aria-label="Cari pelanggan berdasarkan nama, alamat, atau paket"
            className="pl-9"
          />
        </div>
        <div className="flex justify-end">
          <div className="w-full min-w-0 space-y-1.5 sm:w-48">
            <div className="min-w-0 space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-full" aria-label="Status pembayaran"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="belum-bayar">Belum Bayar</SelectItem>
                  <SelectItem value="lunas-cash">Lunas Cash</SelectItem>
                  <SelectItem value="lunas-tf">Lunas TF</SelectItem>
                  <SelectItem value="nyicil">Nyicil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground" aria-live="polite">
        <span>{loading ? 'Memuat pelanggan...' : `Menampilkan ${filteredCustomers.length} dari ${customers.length} pelanggan`}</span>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat data pelanggan...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Users className="h-8 w-8 opacity-50" />
          <p className="text-sm">{search || hasActiveFilters ? 'Tidak ada pelanggan yang cocok dengan filter.' : 'Belum ada data pelanggan.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredCustomers.map((customer) => (
            <li key={customer._id}>
              <Link
                href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
                className="group block animate-fade-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="cursor-pointer border-border/60 transition-colors duration-150 hover:border-primary/40 hover:bg-accent/30">
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{customer.name}</p>
                          <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="wrap-break-word">{customer.address || 'Alamat belum diisi'}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> {formatDateTime(customer.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3 w-3" /> {customer.createdBy || 'Admin'}
                            </span>
                            <span>{customer.packageId ? `${customer.packageId.name} · ${customer.packageId.speed} · ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(customer.packageId.price)}` : 'Belum ada paket'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        <Badge variant="outline" className="text-muted-foreground">Aktif</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
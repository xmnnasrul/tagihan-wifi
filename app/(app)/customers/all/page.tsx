'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Users } from 'lucide-react';
import { CustomerCard } from '@/components/CustomerCard';
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
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState('');
  const hasSearchCriteria = Boolean(search.trim()) || statusFilter !== 'all';

  useEffect(() => {
    if (!hasSearchCriteria || dataLoaded) return;

    let isCurrentRequest = true;
    async function fetchCustomers() {
      setLoading(true);
      setError('');
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
          setDataLoaded(true);
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
  }, [hasSearchCriteria, dataLoaded]);

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
        <span>
          {!hasSearchCriteria
            ? 'Masukkan pencarian atau pilih status untuk melihat pelanggan'
            : loading
              ? 'Mencari pelanggan...'
              : `Menampilkan ${filteredCustomers.length} dari ${customers.length} pelanggan`}
        </span>
      </div>

      {!hasSearchCriteria ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Users className="h-8 w-8 opacity-50" />
          <p className="text-sm">Ketik nama, alamat, atau paket untuk mulai mencari.</p>
        </div>
      ) : loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Mencari data pelanggan...
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <Users className="h-8 w-8 opacity-50" />
          <p className="text-sm">{customers.length ? 'Tidak ada pelanggan yang cocok dengan filter.' : 'Belum ada data pelanggan.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredCustomers.map((customer, index) => (
            <CustomerCard
              key={customer._id}
              customer={customer}
              href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}
              status={{ label: 'Aktif', className: 'text-muted-foreground' }}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(index, 9) * 35}ms` }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
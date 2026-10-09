'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, ChevronDown, Eye, EyeOff, Loader2, MapPin, Phone, Search, Users, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/components/CurrentUserProvider';

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const getBillingPeriod = (billingMonth: string, billingYear: number) => billingYear * 12 + months.indexOf(billingMonth);

interface Package {
  name: string;
  price: number;
  speed?: string;
}

interface Customer {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  packageId: Package | null;
}

interface Billing {
  _id: string;
  customerId: string;
  month: string;
  year: number;
  totalDue: number;
  paidAmount: number;
  packagePrice: number;
  carriedAmount: number;
  installmentAmount: number;
  status: 'TF' | 'Cash' | 'Nyicil' | 'Lunas' | 'Belum Bayar';
}

interface Visit {
  customerId: string;
  collectorUsername: string;
  visitedAt: string | null;
}

interface CollectionTransaction {
  id: string;
  customerName: string;
  month: string;
  year: number;
  amount: number;
  status: string;
  collectorUsername: string;
  addedAt: string;
  note: string;
}

interface DailyCollectionSummary {
  date: string;
  totalAmount: number;
  transactionCount: number;
  transactions: CollectionTransaction[];
}

function getCurrentJakartaPeriod() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  return {
    month: months[Number(parts.find((part) => part.type === 'month')?.value) - 1],
    year: Number(parts.find((part) => part.type === 'year')?.value),
  };
}

function getCurrentJakartaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
}

export default function CollectorPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const canUseCollectorPage = currentUser?.roles.some((role) => role === 'admin' || role === 'collector') ?? false;
  const initialPeriod = getCurrentJakartaPeriod();
  const [month, setMonth] = useState(initialPeriod.month);
  const [year, setYear] = useState(String(initialPeriod.year));
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [visits, setVisits] = useState<Record<string, Visit>>({});
  const [dailySummary, setDailySummary] = useState<DailyCollectionSummary | null>(null);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(true);
  const [dailySummaryDate, setDailySummaryDate] = useState(getCurrentJakartaDate);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [visitFilter, setVisitFilter] = useState('all');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingVisitId, setSavingVisitId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSummary, setPaymentSummary] = useState<number | null>(null);
  const [loadingPaymentSummary, setLoadingPaymentSummary] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'TF' | 'Nyicil'>('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const requestIdRef = useRef(0);
  const paymentSummaryRequestRef = useRef(0);
  const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');

  useEffect(() => {
    if (currentUser && !currentUser.roles.some((role) => role === 'admin' || role === 'collector')) router.replace('/dashboard');
  }, [currentUser, router]);

  const loadData = useCallback(async (searchTerm: string) => {
    const requestId = ++requestIdRef.current;
    if (!searchTerm.trim()) {
      setCustomers([]);
      setBillings([]);
      setVisits({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const period = new URLSearchParams({ month, year });
      const [customerResponse, billingResponse, visitResponse] = await Promise.all([
        fetch(`/api/customers?search=${encodeURIComponent(searchTerm)}`),
        fetch(`/api/billings?${period.toString()}`),
        fetch(`/api/collection-visits?${period.toString()}`),
      ]);
      const [customerData, billingData, visitData] = await Promise.all([
        customerResponse.json(), billingResponse.json(), visitResponse.json(),
      ]);
      if (!customerResponse.ok) throw new Error(customerData.error || 'Gagal mengambil data pelanggan');
      if (!billingResponse.ok) throw new Error(billingData.error || 'Gagal mengambil data tagihan');
      if (!visitResponse.ok) throw new Error(visitData.error || 'Gagal mengambil status kunjungan');

      if (requestId !== requestIdRef.current) return;
      setCustomers(Array.isArray(customerData) ? customerData : []);
      setBillings(Array.isArray(billingData) ? billingData : []);
      setVisits(Object.fromEntries((Array.isArray(visitData) ? visitData : []).map((visit: Visit) => [visit.customerId, visit])));
    } catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error(error instanceof Error ? error.message : 'Gagal memuat data collector');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [month, year]);

  const loadDailySummary = useCallback(async () => {
    if (!canUseCollectorPage) return;
    setDailySummaryLoading(true);
    try {
      const response = await fetch(`/api/collector/summary?date=${encodeURIComponent(dailySummaryDate)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengambil rekap setoran');
      setDailySummary(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengambil rekap setoran');
    } finally {
      setDailySummaryLoading(false);
    }
  }, [canUseCollectorPage, dailySummaryDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(normalizedSearch), normalizedSearch ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadData, normalizedSearch]);

  useEffect(() => {
    void loadDailySummary();
  }, [loadDailySummary]);

  const billingByCustomer = useMemo(() => new Map(billings.map((billing) => [billing.customerId, billing])), [billings]);
  const isSelectedDateToday = dailySummaryDate === getCurrentJakartaDate();
  const visitedCount = customers.filter((customer) => Boolean(visits[customer._id]?.visitedAt)).length;
  const visibleCustomers = normalizedSearch
    ? customers.filter((customer) => {
        const matchesSearch = `${customer.name} ${customer.address || ''} ${customer.phone || ''}`
          .toLocaleLowerCase('id-ID').includes(normalizedSearch);
        const isVisited = Boolean(visits[customer._id]?.visitedAt);
        return matchesSearch && (visitFilter === 'all' || (visitFilter === 'visited' ? isVisited : !isVisited));
      })
    : [];

  const handleVisitToggle = async (customer: Customer, visited: boolean) => {
    setSavingVisitId(customer._id);
    try {
      const response = await fetch('/api/collection-visits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customer._id, month, year: Number(year), visited }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan kunjungan');
      setVisits((current) => ({ ...current, [customer._id]: data }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan kunjungan');
    } finally {
      setSavingVisitId('');
    }
  };

  const openPaymentDialog = async (customer: Customer) => {
    const requestId = ++paymentSummaryRequestRef.current;
    setSelectedCustomer(customer);
    setPaymentSummary(null);
    setLoadingPaymentSummary(true);
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setPaymentNote('');

    try {
      const response = await fetch(`/api/billings?customerId=${encodeURIComponent(customer._id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengambil riwayat tagihan');

      const history = Array.isArray(data) ? data as Billing[] : [];
      const targetPeriod = getBillingPeriod(month, Number(year));
      const currentBilling = history.find((billing) => billing.month === month && billing.year === Number(year));
      const previousUnpaidBilling = history
        .filter((billing) => getBillingPeriod(billing.month, billing.year) < targetPeriod && ['Nyicil', 'Belum Bayar'].includes(billing.status))
        .sort((first, second) => getBillingPeriod(second.month, second.year) - getBillingPeriod(first.month, first.year))[0];
      const previousOutstanding = previousUnpaidBilling
        ? Math.max(0, (previousUnpaidBilling.totalDue || previousUnpaidBilling.packagePrice + previousUnpaidBilling.carriedAmount) - (previousUnpaidBilling.paidAmount || previousUnpaidBilling.installmentAmount || 0))
        : 0;
      const packagePrice = currentBilling?.packagePrice ?? customer.packageId?.price ?? 0;
      const carriedAmount = currentBilling?.carriedAmount ?? previousOutstanding;
      const totalDue = currentBilling
        ? currentBilling.totalDue || packagePrice + carriedAmount
        : packagePrice + carriedAmount;
      const paidAmount = currentBilling?.paidAmount || currentBilling?.installmentAmount || 0;

      if (requestId === paymentSummaryRequestRef.current) {
        setPaymentSummary(Math.max(0, totalDue - paidAmount));
      }
    } catch (error) {
      if (requestId === paymentSummaryRequestRef.current) {
        toast.error(error instanceof Error ? error.message : 'Gagal mengambil riwayat tagihan');
      }
    } finally {
      if (requestId === paymentSummaryRequestRef.current) setLoadingPaymentSummary(false);
    }
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(paymentAmount.replace(/\D/g, ''));
    if (amount <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0');
      return;
    }

    setSavingPayment(true);
    try {
      const response = await fetch('/api/billings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer._id,
          month,
          year: Number(year),
          status: paymentMethod,
          paidAmount: amount,
          installmentAmount: paymentMethod === 'Nyicil' ? amount : 0,
          note: paymentNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mencatat pembayaran');
      toast.success(`Pembayaran ${selectedCustomer.name} berhasil dicatat`);
      setSelectedCustomer(null);
      await loadData(normalizedSearch);
      await loadDailySummary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mencatat pembayaran');
    } finally {
      setSavingPayment(false);
    }
  };

  if (!canUseCollectorPage) return null;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-primary">
          <WalletCards className="h-5 w-5" />
          <span className="text-sm font-semibold">Operasional collector</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Setoran & Kunjungan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cari pelanggan, tandai kunjungan, dan catat pembayaran dalam satu halaman.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <Users className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">Pelanggan ditemukan</p><p className="font-semibold">{loading ? '...' : customers.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <BadgeCheck className="h-5 w-5 text-emerald-500" />
          <div><p className="text-xs text-muted-foreground">Sudah dikunjungi</p><p className="font-semibold">{loading ? '...' : `${visitedCount} / ${customers.length}`}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <div><p className="text-xs text-muted-foreground">Periode</p><p className="font-semibold">{month} {year}</p></div>
        </CardContent></Card>
      </div>

      <section className="space-y-3" aria-labelledby="daily-collection-title">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="daily-collection-title" className="text-lg font-semibold">{isSelectedDateToday ? 'Setoran Hari Ini' : 'Setoran Harian'}</h2>
            <p className="text-sm text-muted-foreground">{dailySummary ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${dailySummary.date}T12:00:00+07:00`)) : 'Rekap transaksi pembayaran'}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                type="date"
                aria-label="Pilih tanggal setoran"
                value={dailySummaryDate}
                onChange={(event) => setDailySummaryDate(event.target.value || getCurrentJakartaDate())}
                className="date-input-calendar w-40 pr-9"
              />
              <CalendarDays aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-emerald-500">{dailySummaryLoading ? 'Memuat...' : formatRupiah(dailySummary?.totalAmount || 0)}</p>
              <p className="text-xs text-muted-foreground">{dailySummaryLoading ? '...' : `${dailySummary?.transactionCount || 0} transaksi`}</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Riwayat Transaksi</h3>
              <p className="text-xs text-muted-foreground">{dailySummaryLoading ? 'Memuat...' : `${dailySummary?.transactionCount || 0} transaksi · ${isSelectedDateToday ? 'hari ini' : 'tanggal terpilih'}`}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTransactionHistory((visible) => !visible)}
              aria-expanded={showTransactionHistory}
            >
              {showTransactionHistory ? <><EyeOff className="mr-2 h-4 w-4" />Sembunyikan</> : <><Eye className="mr-2 h-4 w-4" />Tampilkan</>}
            </Button>
          </div>
          {showTransactionHistory && (dailySummaryLoading ? (
            <div className="flex min-h-16 items-center justify-center rounded-lg border border-border text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memuat transaksi...</div>
          ) : dailySummary?.transactions.length ? (
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {dailySummary.transactions.map((transaction) => (
                <div key={transaction.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transaction.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.month} {transaction.year} · {transaction.status} · {transaction.collectorUsername} · {new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(transaction.addedAt))}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatRupiah(transaction.amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">{isSelectedDateToday ? 'Belum ada pembayaran yang dicatat hari ini.' : 'Tidak ada pembayaran yang dicatat pada tanggal ini.'}</div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, alamat, atau nomor HP" className="pl-9" aria-label="Cari pelanggan" />
          </div>
          <Select value={visitFilter} onValueChange={setVisitFilter}>
            <SelectTrigger className="text-foreground sm:w-48" aria-label="Filter status kunjungan">
              <SelectValue>{visitFilter === 'all' ? 'Semua kunjungan' : visitFilter === 'visited' ? 'Sudah dikunjungi' : 'Belum dikunjungi'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kunjungan</SelectItem>
              <SelectItem value="pending">Belum dikunjungi</SelectItem>
              <SelectItem value="visited">Sudah dikunjungi</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal sm:w-40"
              aria-label="Pilih bulan periode collector"
              onClick={() => setMonthPickerOpen(true)}
            >
              {month}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-full text-foreground sm:w-28" aria-label="Periode tahun"><SelectValue>{year}</SelectValue></SelectTrigger>
              <SelectContent>{Array.from({ length: 5 }, (_, index) => 2026 + index).map((item) => <SelectItem key={item} value={String(item)}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!normalizedSearch ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <Search className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 font-medium">Cari pelanggan untuk mulai</p>
            <p className="mt-1 text-sm text-muted-foreground">Masukkan nama, alamat, atau nomor HP.</p>
          </div>
        ) : loading ? (
          <div className="flex min-h-48 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Mencari pelanggan...</div>
        ) : visibleCustomers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="font-medium">Tidak ada pelanggan yang cocok</p>
            <p className="mt-1 text-sm text-muted-foreground">Ubah pencarian atau filter kunjungan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleCustomers.map((customer) => {
              const billing = billingByCustomer.get(customer._id);
              const visit = visits[customer._id];
              const isVisited = Boolean(visit?.visitedAt);
              const isPaid = billing && ['TF', 'Cash', 'Lunas'].includes(billing.status);
              const due = billing ? billing.totalDue || billing.packagePrice + billing.carriedAmount : customer.packageId?.price || 0;
              const paid = billing?.paidAmount || billing?.installmentAmount || 0;
              const outstanding = Math.max(0, due - paid);

              return (
                <article key={customer._id} className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(130px,.7fr)_minmax(130px,.7fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">
                      <Link href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`} className="hover:text-primary hover:underline">
                        {customer.name}
                      </Link>
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {customer.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{customer.address}</span>}
                      {customer.phone && <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{customer.phone}</a>}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{customer.packageId?.name || 'Paket belum dipilih'}{customer.packageId ? ` · ${formatRupiah(customer.packageId.price)}` : ''}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Tagihan {month}</p>
                    {billing ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm font-medium">Sisa {formatRupiah(outstanding)}</span>
                        <Badge variant="outline" className={isPaid ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 text-amber-700 dark:text-amber-400'}>{billing.status}</Badge>
                      </div>
                    ) : <p className="mt-1 text-sm text-muted-foreground">Belum dibuat</p>}
                  </div>

                  {canUseCollectorPage ? (
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`visit-${customer._id}`}
                        checked={isVisited}
                        disabled={savingVisitId === customer._id}
                        onCheckedChange={(checked) => void handleVisitToggle(customer, checked === true)}
                      />
                      <div className="min-w-0">
                        <Label htmlFor={`visit-${customer._id}`} className="cursor-pointer text-sm font-medium">Sudah dikunjungi</Label>
                        <p className="truncate text-xs text-muted-foreground">
                          {savingVisitId === customer._id ? 'Menyimpan...' : isVisited ? `${visit.collectorUsername} · ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(visit.visitedAt!))}` : 'Belum ada kunjungan'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{isVisited ? 'Sudah dikunjungi' : 'Belum dikunjungi'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {isVisited ? `${visit.collectorUsername} · ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(visit.visitedAt!))}` : 'Status kunjungan'}
                      </p>
                    </div>
                  )}

                  {canUseCollectorPage && (
                    <Button type="button" size="sm" className="w-full sm:w-auto" disabled={!customer.packageId || Boolean(isPaid)} onClick={() => openPaymentDialog(customer)}>
                      {isPaid ? <><Check className="mr-2 h-4 w-4" />Lunas</> : 'Catat'}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih Bulan</DialogTitle>
            <DialogDescription>Pilih periode kunjungan dan pembayaran collector.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {months.map((item, index) => (
              <Button
                key={item}
                type="button"
                variant={month === item ? 'default' : 'outline'}
                onClick={() => {
                  setMonth(item);
                  setMonthPickerOpen(false);
                }}
              >
                {monthShortNames[index]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Catat pembayaran</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name} · {month} {year}. Nominal pembayaran akan dialokasikan ke sisa tagihan sesuai aturan billing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold underline decoration-2 decoration-primary underline-offset-4">
                  {loadingPaymentSummary ? 'Memuat...' : paymentSummary === null ? 'Tidak tersedia' : formatRupiah(paymentSummary)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingPaymentSummary || paymentSummary === null || paymentSummary <= 0}
                  onClick={() => paymentSummary !== null && setPaymentAmount(String(paymentSummary))}
                >
                  Isi sisa
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[150000, 200000, 250000, 300000].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingPaymentSummary || paymentSummary === null || paymentSummary < amount}
                    onClick={() => setPaymentAmount(String(amount))}
                  >
                    {formatRupiah(amount)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="collector-payment-amount">Nominal diterima</Label>
              <Input
                id="collector-payment-amount"
                inputMode="numeric"
                value={formatAmountInput(paymentAmount)}
                onChange={(event) => setPaymentAmount(event.target.value.replace(/\D/g, ''))}
                placeholder="Masukkan nominal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Metode pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'Cash' | 'TF' | 'Nyicil')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Tunai</SelectItem>
                  <SelectItem value="TF">Transfer</SelectItem>
                  <SelectItem value="Nyicil">Cicilan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="collector-payment-note">Catatan</Label>
              <Textarea id="collector-payment-note" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Catatan pembayaran (opsional)" rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedCustomer(null)} disabled={savingPayment}>Batal</Button>
              <Button type="submit" disabled={savingPayment || !paymentAmount}>
                {savingPayment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : 'Simpan pembayaran'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
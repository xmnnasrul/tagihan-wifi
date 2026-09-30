'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getBillingPaidAmount, getBillingTotalDue } from '@/lib/billing-amounts';
import type { PaymentStatus } from '@/lib/models/Billing';

interface BillingListItem {
  _id: string;
  customerId: string;
  customerName: string;
  address: string;
  month: string;
  year: number;
  status: PaymentStatus;
  totalDue: number;
  packagePrice: number;
  carriedAmount: number;
  paidAmount: number;
  installmentAmount: number;
}

interface BillingListPageProps {
  params: { type: string };
  searchParams: { month?: string; year?: string };
}

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function BillingListPage({ params, searchParams }: BillingListPageProps) {
  const type = params.type === 'paid' || params.type === 'unpaid' || params.type === 'belum-bayar'
    ? params.type
    : null;
  const currentMonth = new Date().toLocaleString('id-ID', { month: 'long' });
  const month = searchParams.month && months.includes(searchParams.month) ? searchParams.month : currentMonth;
  const year = searchParams.year && /^\d{4}$/.test(searchParams.year) ? searchParams.year : String(new Date().getFullYear());
  const [billings, setBillings] = useState<BillingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!type) {
      setLoading(false);
      return;
    }

    let isCurrentRequest = true;
    async function fetchBillings() {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({ month, year, activeOnly: 'true' });
        const response = await fetch(`/api/billings?${query.toString()}`);
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data.error || 'Gagal mengambil daftar tagihan');
        }

        const matchingBillings = (data as BillingListItem[]).filter((billing) => {
          if (type === 'belum-bayar') return billing.status === 'Belum Bayar';
          const isPaid = getBillingPaidAmount(billing) >= getBillingTotalDue(billing);
          return type === 'paid' ? isPaid : !isPaid;
        });
        if (isCurrentRequest) setBillings(matchingBillings);
      } catch (err) {
        if (isCurrentRequest) setError(err instanceof Error ? err.message : 'Gagal mengambil daftar tagihan');
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    }

    void fetchBillings();
    return () => {
      isCurrentRequest = false;
    };
  }, [type, month, year]);

  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  const title = type === 'paid'
    ? 'Pelanggan Sudah Lunas'
    : type === 'belum-bayar'
      ? 'Pelanggan Belum Bayar'
      : 'Pelanggan Belum Lunas';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{type ? title : 'Daftar Tagihan Tidak Ditemukan'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Periode {month} {year}</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar pelanggan...
        </div>
      ) : error ? (
        <p role="alert" className="py-6 text-sm text-destructive">{error}</p>
      ) : !type ? (
        <p className="text-sm text-muted-foreground">Kategori tagihan tidak tersedia.</p>
      ) : billings.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada pelanggan pada kategori ini untuk periode tersebut.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{billings.length} pelanggan</p>
          <ul className="space-y-2">
            {billings.map((billing) => {
              const totalDue = getBillingTotalDue(billing);
              const paidAmount = getBillingPaidAmount(billing);
              return (
                <li key={billing._id}>
                  <Link
                    href={`/customers/${billing.customerId}?name=${encodeURIComponent(billing.customerName)}`}
                    className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Card className="cursor-pointer border-border/60 transition-all duration-200 hover:border-primary/40 hover:bg-accent/30">
                      <CardContent className="py-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                              {billing.customerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold">{billing.customerName}</p>
                              <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{billing.address || 'Alamat belum diisi'}</span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" /> {billing.month} {billing.year}
                                </span>
                                <span>Dibayar {formatRupiah(paidAmount)} dari {formatRupiah(totalDue)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                            <Badge className={type === 'paid'
                              ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15'
                              : type === 'belum-bayar'
                                ? 'border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/15'
                                : billing.status === 'Nyicil'
                                ? 'border-amber-500/20 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15'
                                : 'border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/15'}>
                              {type === 'paid'
                                ? 'Lunas'
                                : type === 'belum-bayar'
                                  ? 'Belum Bayar'
                                  : billing.status === 'Nyicil' ? 'Nyicil' : 'Belum Lunas'}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
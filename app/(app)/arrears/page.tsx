'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Loader2, MapPin, Search, Users, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OutstandingPeriod {
  month: string;
  year: number;
  billedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'Belum Bayar' | 'Nyicil';
}

interface ArrearsCustomer {
  customerId: string;
  customerName: string;
  address: string;
  totalOutstanding: number;
  outstandingPeriods: OutstandingPeriod[];
}

export default function ArrearsPage() {
  const [report, setReport] = useState<ArrearsCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Belum Bayar' | 'Nyicil'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrentRequest = true;
    async function fetchReport() {
      try {
        const response = await fetch('/api/arrears');
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data.error || 'Gagal memuat laporan tunggakan');
        }
        if (isCurrentRequest) setReport(data);
      } catch (fetchError) {
        if (isCurrentRequest) setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat laporan tunggakan');
      } finally {
        if (isCurrentRequest) setLoading(false);
      }
    }
    void fetchReport();
    return () => {
      isCurrentRequest = false;
    };
  }, []);

  const filteredReport = useMemo(() => report.filter((customer) => {
    const searchText = `${customer.customerName} ${customer.address}`.toLocaleLowerCase('id-ID');
    const matchesSearch = searchText.includes(search.trim().toLocaleLowerCase('id-ID'));
    const matchesStatus = statusFilter === 'all'
      || customer.outstandingPeriods.some((period) => period.status === statusFilter);
    return matchesSearch && matchesStatus;
  }), [report, search, statusFilter]);

  const totalOutstanding = filteredReport.reduce((sum, customer) => sum + customer.totalOutstanding, 0);
  const outstandingPeriodCount = filteredReport.reduce((sum, customer) => sum + customer.outstandingPeriods.length, 0);
  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laporan Tunggakan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ringkasan sisa tagihan pelanggan aktif dan arsip.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </Link>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total sisa tunggakan</p>
              <p className="mt-1 text-xl font-bold">{formatRupiah(totalOutstanding)}</p>
            </div>
            <Wallet className="h-5 w-5 text-amber-400" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pelanggan menunggak</p>
              <p className="mt-1 text-xl font-bold">{filteredReport.length}</p>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Periode belum lunas</p>
              <p className="mt-1 text-xl font-bold">{outstandingPeriodCount}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <label htmlFor="arrears-search" className="text-xs font-medium text-muted-foreground">Cari pelanggan</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="arrears-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama atau alamat..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="col-span-2 space-y-1.5 sm:col-span-1">
          <label htmlFor="arrears-status" className="text-xs font-medium text-muted-foreground">Status tunggakan</label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger id="arrears-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="Belum Bayar">Belum Bayar</SelectItem>
              <SelectItem value="Nyicil">Nyicil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Menghitung tunggakan...
        </div>
      ) : filteredReport.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-border text-center text-muted-foreground">
          <Wallet className="h-8 w-8 opacity-50" />
          <p className="text-sm">{report.length === 0 ? 'Tidak ada tagihan yang menunggak.' : 'Tidak ada pelanggan yang cocok dengan filter.'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Mulai menunggak</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead className="text-right">Sisa tunggakan</TableHead>
                <TableHead className="text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReport.map((customer) => {
                const oldestPeriod = customer.outstandingPeriods[0];
                const hasUnpaid = customer.outstandingPeriods.some((period) => period.status === 'Belum Bayar');
                const hasInstallment = customer.outstandingPeriods.some((period) => period.status === 'Nyicil');
                return (
                  <TableRow key={customer.customerId}>
                    <TableCell className="max-w-[240px]">
                      <Link href={`/customers/${customer.customerId}?name=${encodeURIComponent(customer.customerName)}`} className="font-medium hover:text-primary">
                        {customer.customerName}
                      </Link>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{customer.address || 'Alamat belum diisi'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {oldestPeriod.month} {oldestPeriod.year}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{customer.outstandingPeriods.length} bulan</span>
                        {hasUnpaid && <Badge className="border-red-500/20 bg-red-500/15 text-red-400 hover:bg-red-500/15">Belum Bayar</Badge>}
                        {hasInstallment && <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-400 hover:bg-amber-500/15">Nyicil</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold">{formatRupiah(customer.totalOutstanding)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/customers/${customer.customerId}?name=${encodeURIComponent(customer.customerName)}`}>Lihat</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
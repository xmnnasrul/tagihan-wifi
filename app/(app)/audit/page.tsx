'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AuditEntry {
  _id: string;
  actorUsername: string;
  action: string;
  entityType: string;
  entityLabel: string;
  summary: string;
  changes?: {
    before: Record<string, string | number | boolean | null> | null;
    after: Record<string, string | number | boolean | null> | null;
  } | null;
  createdAt: string;
}

const changeFieldLabels: Record<string, string> = {
  name: 'Nama',
  address: 'Alamat',
  packageId: 'ID paket',
  status: 'Status',
  archivedAt: 'Waktu arsip',
  price: 'Harga paket',
  speed: 'Kecepatan',
  description: 'Deskripsi',
  paidAmount: 'Total dibayar',
  installmentAmount: 'Total cicilan',
  totalDue: 'Total tagihan',
  note: 'Catatan',
  paymentCount: 'Jumlah pembayaran',
  isActive: 'Status akun',
  username: 'Username',
  role: 'Peran',
  credential: 'Password',
  tokenVersion: 'Versi sesi',
};

const formatChangeValue = (field: string, value: string | number | boolean | null) => {
  if (value === null) return 'Tidak ada';
  if (field === 'isActive' && typeof value === 'boolean') return value ? 'Aktif' : 'Nonaktif';
  if (field === 'status') {
    const labels: Record<string, string> = {
      TF: 'Transfer', Cash: 'Tunai', Nyicil: 'Nyicil', Lunas: 'Lunas',
      'Belum Bayar': 'Belum Bayar', active: 'Aktif', inactive: 'Diarsipkan',
    };
    return labels[String(value)] || String(value);
  }
  if (['price', 'paidAmount', 'installmentAmount', 'totalDue'].includes(field) && typeof value === 'number') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  }
  if (field === 'archivedAt' && typeof value === 'string') {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  return String(value);
};

const categoryLabels: Record<string, string> = {
  all: 'Semua kategori',
  billing: 'Tagihan',
  customer: 'Pelanggan',
  package: 'Paket',
  admin: 'Admin',
};

const actionLabels: Record<string, string> = {
  'billing.created': 'Tagihan dibuat',
  'billing.payment_added': 'Pembayaran dicatat',
  'billing.updated': 'Tagihan diperbarui',
  'billing.deleted': 'Tagihan dihapus',
  'customer.created': 'Pelanggan ditambahkan',
  'customer.updated': 'Pelanggan diperbarui',
  'customer.archived': 'Pelanggan diarsipkan',
  'customer.restored': 'Pelanggan dipulihkan',
  'customer.deleted': 'Pelanggan dihapus permanen',
  'package.created': 'Paket ditambahkan',
  'package.updated': 'Paket diperbarui',
  'package.deleted': 'Paket dihapus',
  'admin.created': 'Admin ditambahkan',
  'admin.activated': 'Admin diaktifkan',
  'admin.deactivated': 'Admin dinonaktifkan',
  'admin.password_reset': 'Password admin direset',
  'admin.password_changed': 'Password admin diubah',
  'user.created': 'Pengguna ditambahkan',
  'user.activated': 'Pengguna diaktifkan',
  'user.deactivated': 'Pengguna dinonaktifkan',
};

export default function AuditPage() {
  const [category, setCategory] = useState('all');
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const fetchItems = useCallback(async (requestedPage: number, replace: boolean) => {
    if (replace) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(requestedPage) });
      if (category !== 'all') params.set('entityType', category);
      const response = await fetch(`/api/audit?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat log aktivitas');
      setItems((current) => replace ? data.items : [...current, ...data.items]);
      setPage(requestedPage);
      setHasMore(data.hasMore);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat log aktivitas');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category]);

  const toggleExpanded = (id: string) => {
    setExpandedItems((current) => current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id]);
  };

  useEffect(() => {
    void fetchItems(1, true);
  }, [fetchItems]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Catatan perubahan data dan akun admin.</p>
        </div>
        <div className="w-full sm:w-52">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Filter kategori aktivitas"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat log...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <History className="h-8 w-8 opacity-50" />
          <p className="text-sm">Belum ada aktivitas pada kategori ini.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Waktu</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead>Ringkasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isExpanded = expandedItems.includes(item._id);
                  const before = item.changes?.before || {};
                  const after = item.changes?.after || {};
                  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
                  return (
                    <Fragment key={item._id}>
                      <TableRow key={item._id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Tutup' : 'Buka'} rincian perubahan ${item.entityLabel}`}
                            onClick={() => toggleExpanded(item._id)}
                            className="h-auto gap-1 px-1 py-1 text-left font-normal text-muted-foreground"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{item.actorUsername}</TableCell>
                        <TableCell>
                          <div>{actionLabels[item.action] || item.action}</div>
                          <div className="text-xs text-muted-foreground">{categoryLabels[item.entityType] || item.entityType}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.entityLabel}</div>
                          <div className="max-w-xl text-sm text-muted-foreground">{item.summary}</div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${item._id}-changes`}>
                          <TableCell colSpan={4} className="bg-muted/20">
                            {fields.length === 0 ? (
                              <p className="py-2 text-sm text-muted-foreground">Rincian sebelum/sesudah tidak tersedia untuk aktivitas lama ini.</p>
                            ) : (
                              <div className="space-y-2 py-1">
                                <div className="hidden border-b border-border pb-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(120px,0.8fr)_1fr_1fr]">
                                  <span>Data</span><span>Sebelum</span><span>Sesudah</span>
                                </div>
                                {fields.map((field) => {
                                  const beforeExists = Object.prototype.hasOwnProperty.call(before, field);
                                  const afterExists = Object.prototype.hasOwnProperty.call(after, field);
                                  const beforeValue = beforeExists
                                    ? formatChangeValue(field, before[field])
                                    : item.changes?.before === null ? 'Belum ada' : '—';
                                  const afterValue = afterExists
                                    ? formatChangeValue(field, after[field])
                                    : item.changes?.after === null ? 'Dihapus' : '—';
                                  return (
                                    <div key={field} className="grid gap-1 border-b border-border/60 py-2 last:border-0 sm:grid-cols-[minmax(120px,0.8fr)_1fr_1fr] sm:gap-3">
                                      <span className="text-sm font-medium">{changeFieldLabels[field] || field}</span>
                                      <span className="break-words text-sm text-muted-foreground"><span className="font-medium sm:hidden">Sebelum: </span>{beforeValue}</span>
                                      <span className="break-words text-sm"><span className="font-medium text-muted-foreground sm:hidden">Sesudah: </span>{afterValue}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => void fetchItems(page + 1, false)}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Muat aktivitas sebelumnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
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
  createdAt: string;
}

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
  'package.created': 'Paket ditambahkan',
  'package.updated': 'Paket diperbarui',
  'package.deleted': 'Paket dihapus',
  'admin.created': 'Admin ditambahkan',
  'admin.activated': 'Admin diaktifkan',
  'admin.deactivated': 'Admin dinonaktifkan',
};

export default function AuditPage() {
  const [category, setCategory] = useState('all');
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Waktu</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead>Ringkasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}
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
                ))}
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
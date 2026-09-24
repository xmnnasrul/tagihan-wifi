'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, ArrowLeft, Eye, Loader2, RotateCcw, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ArchivedCustomer {
  _id: string;
  name: string;
  address: string;
  packageId: { _id: string; name: string; speed: string } | null;
  archivedAt: string | null;
  createdAt?: string;
  createdBy?: string;
}

export default function ArchivedCustomersPage() {
  const [customers, setCustomers] = useState<ArchivedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatDateTime = (value?: string) => value
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '-';

  const fetchArchived = async () => {
    try {
      const res = await fetch('/api/customers?archived=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat pelanggan berhenti');
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pelanggan berhenti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/customers?id=${id}&restore=true`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulihkan pelanggan');
      await fetchArchived();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memulihkan pelanggan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Arsip</h1>
          <p className="text-sm text-muted-foreground mt-1">Daftar pelanggan yang sudah diarsipkan atau berhenti berlangganan</p>
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

      {customers.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <UserX className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada pelanggan yang berhenti berlangganan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <Card key={customer._id} className="border-border/60">
              <CardContent className="py-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold flex-shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{customer.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{customer.address || 'Alamat tidak tersedia'}</p>
                      {customer.packageId && (
                        <p className="text-xs text-muted-foreground mt-1">{customer.packageId.name} · {customer.packageId.speed}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Ditambahkan {formatDateTime(customer.createdAt)} oleh {customer.createdBy || 'Admin'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {customer.archivedAt && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                        Arsip sejak {new Date(customer.archivedAt).toLocaleDateString('id-ID')}
                      </Badge>
                    )}
                    <Button variant="outline" asChild>
                      <Link href={`/customers/${customer._id}?name=${encodeURIComponent(customer.name)}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Lihat riwayat
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={() => handleRestore(customer._id)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Pulihkan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

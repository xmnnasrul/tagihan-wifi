'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, MapPin, Wifi, Loader2, Trash2, Pencil, Check, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Billing {
  _id: string;
  customerName: string;
  address: string;
  packageName: string;
  packagePrice: number;
  month: string;
  year: number;
  status: 'TF' | 'Cash' | 'Nyicil';
  installmentAmount: number;
  note: string;
  createdAt: string;
}

export default function CustomerDetailPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const params = use(searchParams);
  const router = useRouter();
  const customerName = params.name || '';
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editBilling, setEditBilling] = useState<Billing | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editInstallment, setEditInstallment] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerName) return;
    fetchBillings();
  }, [customerName]);

  const fetchBillings = async () => {
    try {
      const res = await fetch(`/api/billings?customerName=${encodeURIComponent(customerName)}`);
      const data = await res.json();
      setBillings(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`/api/billings?id=${deleteId}`, { method: 'DELETE' });
      await fetchBillings();
    } catch {
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (billing: Billing) => {
    setEditBilling(billing);
    setEditStatus(billing.status);
    setEditInstallment(String(billing.installmentAmount || ''));
    setEditNote(billing.note || '');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBilling) return;
    setSaving(true);
    try {
      await fetch('/api/billings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editBilling._id,
          status: editStatus,
          installmentAmount: editStatus === 'Nyicil' ? Number(editInstallment) : 0,
          note: editNote,
        }),
      });
      setEditBilling(null);
      await fetchBillings();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'TF' || status === 'Cash') {
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">{status === 'TF' ? 'Transfer' : 'Tunai'}</Badge>;
    }
    if (status === 'Nyicil') {
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/15">Nyicil</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalPaid = billings.reduce((sum, b) => {
    if (b.status === 'TF' || b.status === 'Cash') return sum + b.packagePrice;
    if (b.status === 'Nyicil') return sum + b.installmentAmount;
    return sum;
  }, 0);

  const totalOutstanding = billings.reduce((sum, b) => {
    if (b.status === 'Nyicil') return sum + (b.packagePrice - b.installmentAmount);
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </div>

      {/* Customer info card */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl flex-shrink-0">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{customerName}</h1>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {billings[0]?.address && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {billings[0].address}
                  </span>
                )}
                {billings[0]?.packageName && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Wifi className="h-3.5 w-3.5" />
                    {billings[0].packageName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Total Tagihan</p>
              <p className="text-lg font-bold mt-1">{billings.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lunas</p>
              <p className="text-lg font-bold mt-1 text-emerald-400">
                {billings.filter((b) => b.status === 'TF' || b.status === 'Cash').length}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Dibayar</p>
              <p className="text-lg font-bold mt-1">{formatRupiah(totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sisa Cicilan</p>
              <p className="text-lg font-bold mt-1 text-amber-400">{formatRupiah(totalOutstanding)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing history */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Riwayat Tagihan</h2>

        {billings.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada riwayat tagihan untuk pelanggan ini.</p>
              <Button asChild className="mt-4">
                <Link href="/billing/add">Tambah Tagihan</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Bulan</TableHead>
                    <TableHead>Tahun</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dibayar</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billings.map((billing) => (
                    <TableRow key={billing._id} className="group">
                      <TableCell className="font-medium">{billing.month}</TableCell>
                      <TableCell>{billing.year}</TableCell>
                      <TableCell className="text-muted-foreground">{billing.packageName}</TableCell>
                      <TableCell className="text-right">{formatRupiah(billing.packagePrice)}</TableCell>
                      <TableCell>{getStatusBadge(billing.status)}</TableCell>
                      <TableCell className="text-right">
                        {billing.status === 'Nyicil'
                          ? formatRupiah(billing.installmentAmount)
                          : billing.status === 'TF' || billing.status === 'Cash'
                            ? formatRupiah(billing.packagePrice)
                            : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {billing.note || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(billing)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(billing._id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tagihan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data tagihan akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editBilling} onOpenChange={(open) => !open && setEditBilling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tagihan</DialogTitle>
            <DialogDescription>
              {editBilling?.month} {editBilling?.year} - {editBilling?.customerName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Status Pembayaran</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TF">TF (Transfer)</SelectItem>
                  <SelectItem value="Cash">Cash (Tunai)</SelectItem>
                  <SelectItem value="Nyicil">Nyicil (Cicilan)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editStatus === 'Nyicil' && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="edit-installment">Nominal Cicilan</Label>
                <Input
                  id="edit-installment"
                  type="number"
                  value={editInstallment}
                  onChange={(e) => setEditInstallment(e.target.value)}
                  placeholder="Masukkan nominal"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-note">Catatan</Label>
              <Textarea
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditBilling(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

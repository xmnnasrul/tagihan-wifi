'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, MapPin, Wifi, Loader2, Trash2, Pencil, Check, Clock, AlertCircle, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  paidAmount: number;
  month: string;
  year: number;
  status: 'TF' | 'Cash' | 'Nyicil';
  installmentAmount: number;
  note: string;
  createdAt: string;
}

interface Package {
  _id: string;
  name: string;
  price: number;
  speed: string;
  description: string;
}

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = (params?.id as string) || '';
  const customerName = searchParams.get('name') || '';
  const [customer, setCustomer] = useState<{ name: string; address: string; packageId?: Package | string | null } | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPackageId, setCustomerPackageId] = useState('');
  const [billingMonth, setBillingMonth] = useState(months[new Date().getMonth()]);
  const [billingYear, setBillingYear] = useState(String(new Date().getFullYear()));
  const [billingStatus, setBillingStatus] = useState<'TF' | 'Cash' | 'Nyicil' | ''>('');
  const [billingAmount, setBillingAmount] = useState('');
  const [billingNote, setBillingNote] = useState('');
  const [savingBilling, setSavingBilling] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editBilling, setEditBilling] = useState<Billing | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editInstallment, setEditInstallment] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    fetchCustomer();
    fetchBillings();
    fetchPackages();
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      const res = await fetch(`/api/customers?id=${customerId}`);
      const data = await res.json();
      if (!res.ok || !data) throw new Error(data.error || 'Pelanggan tidak ditemukan');
      setCustomer(data);
      setCustomerAddress(data.address || '');
      setCustomerPackageId(typeof data.packageId === 'object' && data.packageId ? data.packageId._id : data.packageId || '');
      if (data.packageId && typeof data.packageId === 'object') setBillingAmount(String(data.packageId.price));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengambil data pelanggan');
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      setPackages(await res.json());
    } catch {
      toast.error('Gagal mengambil daftar paket');
    }
  };

  const fetchBillings = async () => {
    try {
      const res = await fetch(`/api/billings?customerId=${encodeURIComponent(customerId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil riwayat tagihan');
      setBillings(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal mengambil riwayat tagihan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: customerId, address: customerAddress, packageId: customerPackageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui pelanggan');
      setCustomer(data);
      setEditingCustomer(false);
      toast.success('Data pelanggan berhasil diperbarui');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui pelanggan');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleAddBilling = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!billingStatus) {
      toast.error('Status pembayaran wajib dipilih');
      return;
    }
    if (billingStatus === 'Nyicil' && !billingAmount) {
      toast.error('Nominal yang sudah dibayar wajib diisi untuk cicilan');
      return;
    }

    setSavingBilling(true);
    try {
      const res = await fetch('/api/billings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          month: billingMonth,
          year: Number(billingYear),
          status: billingStatus,
          paidAmount: Number(billingAmount) || 0,
          installmentAmount: billingStatus === 'Nyicil' ? Number(billingAmount) : 0,
          note: billingNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah tagihan');
      toast.success('Tagihan berhasil ditambahkan');
      setBillingAmount('');
      setBillingNote('');
      setBillingStatus('');
      await fetchBillings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menambah tagihan');
    } finally {
      setSavingBilling(false);
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

  const handleArchiveCustomer = async () => {
    if (!customerId) return;
    try {
      const res = await fetch(`/api/customers?id=${customerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengarsipkan pelanggan');
      }
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengarsipkan pelanggan');
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

  const displayCustomerName = customer?.name || customerName;
  const currentPackage = customer?.packageId && typeof customer.packageId === 'object' ? customer.packageId : null;

  const totalPaid = billings.reduce((sum, b) => {
    if (b.paidAmount) return sum + b.paidAmount;
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Dashboard
        </Link>
        <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={handleArchiveCustomer}>
          <Archive className="h-4 w-4 mr-2" />
          Arsipkan Pelanggan
        </Button>
      </div>

      {/* Customer info card */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-xl flex-shrink-0">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{displayCustomerName}</h1>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {billings[0]?.address && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {billings[0].address}
                  </span>
                )}
                {currentPackage?.name && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Wifi className="h-3.5 w-3.5" />
                    {currentPackage.name}
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

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Data Pelanggan</CardTitle>
            <CardDescription>Perubahan paket berlaku untuk tagihan baru. Riwayat lama tetap memakai harga sebelumnya.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditingCustomer((value) => !value)}>
            <Pencil className="h-4 w-4 mr-2" />
            {editingCustomer ? 'Batal' : 'Edit Data'}
          </Button>
        </CardHeader>
        <CardContent>
          {editingCustomer ? (
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-address">Alamat</Label>
                <Input id="customer-address" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Paket</Label>
                <Select value={customerPackageId} onValueChange={setCustomerPackageId}>
                  <SelectTrigger><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg._id} value={pkg._id}>{pkg.name} - {formatRupiah(pkg.price)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={savingCustomer}>
                {savingCustomer ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
              </Button>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div><p className="text-muted-foreground">Alamat</p><p className="mt-1">{customer?.address || '-'}</p></div>
              <div><p className="text-muted-foreground">Paket aktif</p><p className="mt-1">{currentPackage ? `${currentPackage.name} - ${formatRupiah(currentPackage.price)}` : '-'}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Tambah Tagihan Bulanan</CardTitle>
          <CardDescription>Nama, alamat, dan paket diambil otomatis dari data pelanggan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddBilling} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={billingMonth} onValueChange={setBillingMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map((month) => <SelectItem key={month} value={month}>{month}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Select value={billingYear} onValueChange={setBillingYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - index).map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-amount">Nominal Dibayar</Label>
                <Input id="billing-amount" type="number" min="0" value={billingAmount} onChange={(event) => setBillingAmount(event.target.value)} placeholder={currentPackage ? String(currentPackage.price) : 'Masukkan nominal'} />
                <p className="text-xs text-muted-foreground">Otomatis dari paket, tetapi bisa diedit.</p>
              </div>
              <div className="space-y-2">
                <Label>Status Pembayaran</Label>
                <Select value={billingStatus} onValueChange={(value) => setBillingStatus(value as 'TF' | 'Cash' | 'Nyicil')}>
                  <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TF">TF (Transfer)</SelectItem>
                    <SelectItem value="Cash">Cash (Tunai)</SelectItem>
                    <SelectItem value="Nyicil">Nyicil (Cicilan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-note">Keterangan</Label>
              <Textarea id="billing-note" value={billingNote} onChange={(event) => setBillingNote(event.target.value)} placeholder="Keterangan tambahan (opsional)" rows={3} />
            </div>
            <Button type="submit" disabled={savingBilling || !currentPackage}>
              {savingBilling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan Tagihan'}
            </Button>
          </form>
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
                          ? formatRupiah(billing.paidAmount || billing.installmentAmount)
                          : billing.status === 'TF' || billing.status === 'Cash'
                            ? formatRupiah(billing.paidAmount || billing.packagePrice)
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

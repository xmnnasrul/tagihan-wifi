'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
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
import PageSkeleton from '@/components/PageSkeleton';

interface Billing {
  _id: string;
  customerName: string;
  address: string;
  packageName: string;
  packagePrice: number;
  carriedAmount?: number;
  totalDue?: number;
  paidAmount: number;
  month: string;
  year: number;
  status: 'TF' | 'Cash' | 'Nyicil' | 'Lunas';
  installmentAmount: number;
  note: string;
  createdAt: string;
  paymentHistory?: PaymentHistory[];
}

interface PaymentHistory {
  _id?: string;
  amount: number;
  addedAt: string;
  addedBy: string;
  status: 'TF' | 'Cash' | 'Nyicil' | 'Lunas';
  note: string;
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

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const getBillingPeriod = (month: string, year: number) => year * 12 + months.indexOf(month);

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = (params?.id as string) || '';
  const customerName = searchParams.get('name') || '';
  const [customer, setCustomer] = useState<{ name: string; address: string; status?: 'active' | 'inactive'; packageId?: Package | string | null } | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPackageId, setCustomerPackageId] = useState('');
  const [billingMonth, setBillingMonth] = useState(months[new Date().getMonth()]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [billingYear, setBillingYear] = useState(String(new Date().getFullYear()));
  const [billingStatus, setBillingStatus] = useState<'TF' | 'Cash' | 'Nyicil' | ''>('');
  const [billingAmount, setBillingAmount] = useState('');
  const [billingNote, setBillingNote] = useState('');
  const [savingBilling, setSavingBilling] = useState(false);
  const [showBillingForm, setShowBillingForm] = useState(false);
  const [canDismissBillingForm, setCanDismissBillingForm] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editBilling, setEditBilling] = useState<Billing | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editInstallment, setEditInstallment] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedBillingIds, setExpandedBillingIds] = useState<string[]>([]);
  const [selectedBillingId, setSelectedBillingId] = useState<string | null>(null);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers?id=${customerId}`);
      const data = await res.json();
      if (!res.ok || !data) throw new Error(data?.error || 'Pelanggan tidak ditemukan');
      setCustomer(data);
      setCustomerAddress(data.address || '');
      setCustomerPackageId(typeof data.packageId === 'object' && data.packageId ? data.packageId._id : data.packageId || '');
      if (data.packageId && typeof data.packageId === 'object') setBillingAmount(String(data.packageId.price));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengambil data pelanggan');
    }
  }, [customerId]);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal mengambil daftar paket');
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Gagal mengambil daftar paket');
    }
  }, []);

  const fetchBillings = useCallback(async () => {
    try {
      const res = await fetch(`/api/billings?customerId=${encodeURIComponent(customerId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Gagal mengambil riwayat tagihan');
      setBillings(Array.isArray(data) ? data.filter(Boolean) : []);
      if (Array.isArray(data) && data.length > 0) {
        setShowBillingForm(true);
        setCanDismissBillingForm(false);
      }
    } catch {
      toast.error('Gagal mengambil riwayat tagihan');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    fetchCustomer();
    fetchBillings();
    fetchPackages();
  }, [customerId, fetchCustomer, fetchBillings, fetchPackages]);

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
    const amount = getAmountValue(billingAmount);
    const existingBilling = billings.find((billing) => billing.month === billingMonth && billing.year === Number(billingYear));
    const alreadyPaid = existingBilling?.paidAmount || existingBilling?.installmentAmount || 0;
    const remainingAmount = currentDueAmount - alreadyPaid;
    if (billingStatus === 'Nyicil' && amount > remainingAmount) {
      toast.error(`Cicilan terlalu besar. Maksimal ${formatRupiah(Math.max(0, remainingAmount))} untuk bulan ini.`);
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

  const handleCancelBilling = () => {
    setBillingStatus('');
    setBillingAmount('');
    setBillingNote('');
    if (canDismissBillingForm) setShowBillingForm(false);
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
      const res = await fetch('/api/billings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editBilling._id,
          status: editStatus,
          installmentAmount: editStatus === 'Nyicil' ? Number(editInstallment) : 0,
          note: editNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengedit tagihan');
      setEditBilling(null);
      await fetchBillings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengedit tagihan');
    } finally {
      setSaving(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDateTime = (value: string) => new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

  const getPaymentHistory = (billing: Billing): PaymentHistory[] => billing.paymentHistory?.length
    ? billing.paymentHistory
    : [{
        amount: billing.paidAmount || billing.packagePrice,
        addedAt: billing.createdAt,
        addedBy: 'Data lama',
        status: billing.status,
        note: billing.note || '',
      }];

  const openBillingDetails = (billingId: string) => {
    setExpandedBillingIds((current) => current.includes(billingId) ? current : [...current, billingId]);
  };

  const handleBillingRowClick = (billingId: string) => {
    if (selectedBillingId === billingId && expandedBillingIds.includes(billingId)) {
      setSelectedBillingId(null);
      setExpandedBillingIds((current) => current.filter((id) => id !== billingId));
      return;
    }
    setSelectedBillingId(billingId);
    openBillingDetails(billingId);
  };

  const visibleBillings = selectedBillingId
    ? billings.filter((billing) => billing._id === selectedBillingId)
    : billings;

  const getStatusBadge = (status: string) => {
    if (status === 'TF' || status === 'Cash' || status === 'Lunas') {
      if (status === 'Lunas') {
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">Lunas</Badge>;
      }
      return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">{status === 'TF' ? 'Transfer' : 'Tunai'}</Badge>;
    }
    if (status === 'Nyicil') {
      return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 hover:bg-amber-500/15">Nyicil</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatAmountInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
  };

  const getAmountValue = (value: string) => Number(value.replace(/\D/g, '')) || 0;

  if (loading) {
    return <PageSkeleton />;
  }

  const displayCustomerName = customer?.name || customerName;
  const isArchived = customer?.status === 'inactive';
  const currentPackage = customer?.packageId && typeof customer.packageId === 'object' ? customer.packageId : null;
  const selectedBilling = billings.find((billing) => billing.month === billingMonth && billing.year === Number(billingYear));
  const previousBilling = billings
    .filter((billing) => getBillingPeriod(billing.month, billing.year) < getBillingPeriod(billingMonth, Number(billingYear)))
    .sort((a, b) => getBillingPeriod(b.month, b.year) - getBillingPeriod(a.month, a.year))[0];
  const previousOutstanding = previousBilling?.status === 'Nyicil'
    ? Math.max(0, (previousBilling.totalDue || previousBilling.packagePrice) - (previousBilling.paidAmount || 0))
    : 0;
  const currentDueAmount = selectedBilling?.totalDue || (currentPackage?.price ?? 0) + previousOutstanding;
  const currentPaidAmount = selectedBilling?.paidAmount || selectedBilling?.installmentAmount || 0;
  const currentRemainingAmount = Math.max(0, currentDueAmount - currentPaidAmount);
  const totalPaid = billings.reduce((sum, b) => {
    if (b.paidAmount) return sum + b.paidAmount;
    if (b.status === 'TF' || b.status === 'Cash' || b.status === 'Lunas') return sum + (b.paidAmount || b.packagePrice);
    if (b.status === 'Nyicil') return sum + b.installmentAmount;
    return sum;
  }, 0);

  const totalOutstanding = billings.reduce((sum, b) => {
    if (b.status === 'Nyicil') return sum + ((b.totalDue || b.packagePrice) - b.installmentAmount);
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={isArchived ? '/archived' : '/dashboard'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" />
          {isArchived ? 'Kembali ke Arsip' : 'Kembali ke Dashboard'}
        </Link>
        {!isArchived && (
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={handleArchiveCustomer}>
            <Archive className="h-4 w-4 mr-2" />
            Arsipkan Pelanggan
          </Button>
        )}
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
                      {billings.filter((b) => b.status === 'TF' || b.status === 'Cash' || b.status === 'Lunas').length}
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

      <div className="grid min-w-0 gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <Card className="border-border/60 h-fit min-w-0">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Data Pelanggan</CardTitle>
              <CardDescription>Perubahan paket berlaku untuk tagihan baru. Riwayat lama tetap memakai harga sebelumnya.</CardDescription>
            </div>
            {!isArchived && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingCustomer((value) => !value)}>
                <Pencil className="h-4 w-4 mr-2" />
                {editingCustomer ? 'Batal' : 'Edit'}
              </Button>
            )}
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
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Alamat</p>
                  <p className="mt-1 font-medium">{customer?.address || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paket aktif</p>
                  <p className="mt-1 font-medium">{currentPackage ? `${currentPackage.name} - ${formatRupiah(currentPackage.price)}` : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tagihan bulan ini</p>
                  <p className="mt-1 font-medium text-lg">{formatRupiah(currentDueAmount)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!isArchived && showBillingForm && <Card className="border-border/60 min-w-0" id="billing-form">
          <CardHeader>
            <CardTitle className="text-lg">Tambah Tagihan Bulanan</CardTitle>
            <CardDescription>Nama, alamat, dan paket diambil otomatis dari data pelanggan.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddBilling} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bulan</Label>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal" onClick={() => setMonthPickerOpen(true)}>
                    {months[months.indexOf(billingMonth)] || billingMonth}
                    <span className="text-xs text-muted-foreground">Pilih</span>
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Tahun</Label>
                  <Select value={billingYear} onValueChange={setBillingYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, index) => 2026 + index).map((year) => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status Pembayaran</Label>
                  <Select value={billingStatus} onValueChange={(value) => {
                    const nextStatus = value as 'TF' | 'Cash' | 'Nyicil';
                    setBillingStatus(nextStatus);
                    if (currentPackage && (nextStatus === 'TF' || nextStatus === 'Cash')) {
                      setBillingAmount(String(currentRemainingAmount));
                    }
                    if (currentPackage && nextStatus === 'Nyicil' && !billingAmount) {
                      setBillingAmount(String(Math.round(currentRemainingAmount / 2)));
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TF">TF (Transfer)</SelectItem>
                      <SelectItem value="Cash">Cash (Tunai)</SelectItem>
                      <SelectItem value="Nyicil">Nyicil (Cicilan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing-amount">{billingStatus === 'Nyicil' ? 'Nominal Cicilan' : 'Nominal Dibayar'}</Label>
                  <Input
                    id="billing-amount"
                    type="text"
                    inputMode="numeric"
                    value={formatAmountInput(billingAmount)}
                    onChange={(event) => setBillingAmount(event.target.value.replace(/\D/g, ''))}
                    placeholder={currentPackage ? formatRupiah(currentRemainingAmount) : 'Masukkan nominal'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {billingStatus === 'Nyicil'
                      ? `Masukkan nominal cicilan. Sisa tagihan ${formatRupiah(currentRemainingAmount)}${previousOutstanding > 0 ? ` termasuk tunggakan ${formatRupiah(previousOutstanding)} dari bulan sebelumnya.` : '.'}`
                      : `Jumlah yang dibayar untuk ${currentPackage?.name ?? 'paket'} adalah ${formatRupiah(currentDueAmount)}.`}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-note">Keterangan</Label>
                <Textarea id="billing-note" value={billingNote} onChange={(event) => setBillingNote(event.target.value)} placeholder="Keterangan tambahan (opsional)" rows={3} />
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={savingBilling || !currentPackage}>
                    {savingBilling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan Tagihan'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancelBilling}>
                    Batal
                  </Button>
                </div>
                {currentPackage && (
                  <p className="text-sm text-muted-foreground">Total tagihan: {formatRupiah(currentDueAmount)}</p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>}
      </div>

      {/* Billing history */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Riwayat Tagihan</h2>

        {billings.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Belum ada riwayat tagihan untuk pelanggan ini.</p>
              {!isArchived && (
                <Button type="button" className="mt-4" onClick={() => {
                  setCanDismissBillingForm(true);
                  setShowBillingForm(true);
                }}>
                  Tambah Tagihan
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60 min-w-0 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Bulan</TableHead>
                    <TableHead>Tahun</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Dibayar</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBillings.map((billing) => {
                    const paymentHistory = getPaymentHistory(billing);
                    const isExpanded = expandedBillingIds.includes(billing._id);
                    return (
                      <Fragment key={billing._id}>
                        <TableRow className="group cursor-pointer transition-colors duration-200" onClick={() => handleBillingRowClick(billing._id)}>
                      <TableCell className="font-medium">{billing.month}</TableCell>
                      <TableCell>{billing.year}</TableCell>
                      <TableCell>{getStatusBadge(billing.status)}</TableCell>
                      <TableCell className="text-right">{formatRupiah(billing.paidAmount || billing.installmentAmount || 0)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{billing.note || '-'}</TableCell>
                      <TableCell>
                        {!isArchived && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(event) => { event.stopPropagation(); openEdit(billing); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(event) => { event.stopPropagation(); setDeleteId(billing._id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={6} className="p-0">
                              <div className="animate-fade-in space-y-3 border-l-2 border-primary/40 px-4 py-4 sm:ml-6">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail pembayaran</p>
                                {paymentHistory.map((payment, paymentIndex) => (
                                  <div key={`${billing._id}-${payment._id || paymentIndex}`} className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/50 p-3 text-sm">
                                    <div>
                                      <p className="font-medium">Pembayaran ke-{paymentIndex + 1}</p>
                                      <p className="text-xs text-muted-foreground">{formatDateTime(payment.addedAt)} oleh {payment.addedBy || 'Admin'}</p>
                                      <p className="mt-1 font-semibold">Nominal: {formatRupiah(payment.amount)}</p>
                                    </div>
                                    <div className="self-start">{getStatusBadge(payment.status)}</div>
                                    {payment.note && <p className="text-xs text-muted-foreground">Catatan: {payment.note}</p>}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih Bulan</DialogTitle>
            <DialogDescription>Pilih bulan tagihan yang ingin ditambahkan.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            {months.map((month, index) => (
              <Button
                key={month}
                type="button"
                variant={billingMonth === month ? 'default' : 'outline'}
                onClick={() => {
                  setBillingMonth(month);
                  setMonthPickerOpen(false);
                }}
              >
                {monthShortNames[index]}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
                  <SelectItem value="Lunas">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editStatus === 'Nyicil' && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="edit-installment">Total Cicilan yang Sudah Dibayar</Label>
                <Input
                  id="edit-installment"
                  type="text"
                  inputMode="numeric"
                  value={formatAmountInput(editInstallment)}
                  onChange={(e) => setEditInstallment(e.target.value.replace(/\D/g, ''))}
                  placeholder="Contoh: 100.000"
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

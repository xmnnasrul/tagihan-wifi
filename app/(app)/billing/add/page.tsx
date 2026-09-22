'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus, Loader2, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

export default function AddBillingPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [packageId, setPackageId] = useState('');
  const [month, setMonth] = useState(months[new Date().getMonth()]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState<'TF' | 'Cash' | 'Nyicil' | ''>('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('/api/packages')
      .then((r) => r.json())
      .then(setPackages)
      .catch(() => {});
  }, []);

  const selectedPackage = packages.find((p) => p._id === packageId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!customerName || !packageId || !month || !year || !status) {
      setError('Semua field wajib harus diisi');
      setLoading(false);
      return;
    }

    if (status === 'Nyicil' && !installmentAmount) {
      setError('Nominal cicilan wajib diisi untuk status Nyicil');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/billings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          address,
          packageId,
          month,
          year: Number(year),
          status,
          installmentAmount: status === 'Nyicil' ? Number(installmentAmount) : 0,
          note,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal menambah tagihan');
        return;
      }

      setSuccess(`Tagihan untuk ${customerName} berhasil ditambahkan!`);

      setTimeout(() => {
        setCustomerName('');
        setAddress('');
        setPackageId('');
        setStatus('');
        setInstallmentAmount('');
        setNote('');
        setSuccess('');
      }, 2000);
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah Data Tagihan</h1>
        <p className="text-sm text-muted-foreground mt-1">Input tagihan bulanan untuk pelanggan</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FilePlus className="h-5 w-5 text-primary" />
            Form Tagihan
          </CardTitle>
          <CardDescription>Isi data pelanggan dan detail tagihan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Customer info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Nama Pelanggan <span className="text-destructive">*</span></Label>
                <Input
                  id="customerName"
                  placeholder="Masukkan nama pelanggan"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Jika pelanggan baru, sistem akan otomatis mendaftarkannya</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Input
                  id="address"
                  placeholder="Masukkan alamat pelanggan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Billing details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paket <span className="text-destructive">*</span></Label>
                <Select value={packageId} onValueChange={setPackageId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg._id} value={pkg._id}>
                        {pkg.name} - {formatRupiah(pkg.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPackage && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPackage.speed} - {selectedPackage.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Bulan <span className="text-destructive">*</span></Label>
                <Select value={month} onValueChange={setMonth} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tahun <span className="text-destructive">*</span></Label>
                <Select value={year} onValueChange={setYear} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status Pembayaran <span className="text-destructive">*</span></Label>
                <Select value={status} onValueChange={(v) => setStatus(v as 'TF' | 'Cash' | 'Nyicil')} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TF">TF (Transfer)</SelectItem>
                    <SelectItem value="Cash">Cash (Tunai)</SelectItem>
                    <SelectItem value="Nyicil">Nyicil (Cicilan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Conditional installment field */}
            {status === 'Nyicil' && (
              <div className="space-y-2 animate-fade-in rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <Label htmlFor="installmentAmount" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-400" />
                  Nominal Cicilan <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="installmentAmount"
                  type="number"
                  placeholder="Masukkan nominal yang sudah dibayarkan"
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  required
                />
                {selectedPackage && installmentAmount && (
                  <p className="text-xs text-amber-400/80">
                    Sisa: {formatRupiah(selectedPackage.price - Number(installmentAmount || 0))}
                    {' '}/ {formatRupiah(selectedPackage.price)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">Catatan</Label>
              <Textarea
                id="note"
                placeholder="Catatan tambahan (opsional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Tagihan'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

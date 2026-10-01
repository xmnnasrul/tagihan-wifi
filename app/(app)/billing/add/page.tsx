'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Package {
  _id: string;
  name: string;
  price: number;
  speed: string;
  description: string;
}

export default function AddCustomerPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [packageId, setPackageId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/packages')
      .then((response) => response.json())
      .then(setPackages)
      .catch(() => toast.error('Gagal mengambil daftar paket'));
  }, []);

  const selectedPackage = packages.find((pkg) => pkg._id === packageId);
  const formatRupiah = (amount: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !address.trim() || !packageId) {
      toast.error('Nama, alamat, dan paket wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, phone, packageId }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Gagal menambahkan pelanggan');
        return;
      }

      toast.success('Pelanggan berhasil ditambahkan');
      setName('');
      setAddress('');
      setPhone('');
      setPackageId('');
    } catch {
      toast.error('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah Pelanggan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daftarkan pelanggan sebelum menambahkan tagihan bulanannya</p>
      </div>

      <Card className="overflow-hidden border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.03] shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-border/80">
        <CardHeader className="border-b border-border/80 bg-violet-500/[0.03] pb-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                  <FilePlus className="h-4 w-4" />
                </div>
                Data Pelanggan
              </CardTitle>
              <CardDescription className="mt-2 text-sm">Data pelanggan akan digunakan pada halaman detail pelanggan.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customer-name" className="text-sm font-medium">Nama Pelanggan <span className="text-destructive">*</span></Label>
                <Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Masukkan nama pelanggan" className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30" required />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customer-address" className="text-sm font-medium">Alamat <span className="text-destructive">*</span></Label>
                <Input id="customer-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Masukkan alamat pelanggan" className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone" className="text-sm font-medium">HP</Label>
                <Input id="customer-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Masukkan nomor HP" autoComplete="tel" className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Paket <span className="text-destructive">*</span></Label>
                <Select value={packageId} onValueChange={setPackageId} required>
                  <SelectTrigger className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus:ring-violet-500/30">
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => <SelectItem key={pkg._id} value={pkg._id}>{pkg.name} - {formatRupiah(pkg.price)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedPackage && <p className="text-xs text-muted-foreground">{selectedPackage.speed} - {selectedPackage.description}</p>}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard')} className="w-full sm:w-auto">Batal</Button>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 sm:w-auto">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan Pelanggan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

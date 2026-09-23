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
    if (!name || !packageId) {
      toast.error('Nama dan paket wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, packageId }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Gagal menambahkan pelanggan');
        return;
      }

      toast.success('Pelanggan berhasil ditambahkan');
      router.push(`/customers/${data._id}?name=${encodeURIComponent(data.name)}`);
    } catch {
      toast.error('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tambah Pelanggan</h1>
        <p className="text-sm text-muted-foreground mt-1">Daftarkan pelanggan sebelum menambahkan tagihan bulanannya</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FilePlus className="h-5 w-5 text-primary" />
            Data Pelanggan
          </CardTitle>
          <CardDescription>Nama, alamat, dan paket akan digunakan pada halaman detail pelanggan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nama Pelanggan <span className="text-destructive">*</span></Label>
              <Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Masukkan nama pelanggan" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-address">Alamat</Label>
              <Input id="customer-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Masukkan alamat pelanggan" />
            </div>

            <div className="space-y-2">
              <Label>Paket <span className="text-destructive">*</span></Label>
              <Select value={packageId} onValueChange={setPackageId} required>
                <SelectTrigger><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                <SelectContent>
                  {packages.map((pkg) => <SelectItem key={pkg._id} value={pkg._id}>{pkg.name} - {formatRupiah(pkg.price)}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedPackage && <p className="text-xs text-muted-foreground">{selectedPackage.speed} - {selectedPackage.description}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : 'Simpan Pelanggan'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/dashboard')}>Batal</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Package as PackageIcon, Plus, Pencil, Trash2, Loader2, AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Package {
  _id: string;
  name: string;
  price: number;
  speed: string;
  description: string;
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [speed, setSpeed] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      const data = await res.json();
      setPackages(data);
    } catch {
      setError('Gagal memuat data paket');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingPkg(null);
    setName('');
    setPrice('');
    setSpeed('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (pkg: Package) => {
    setEditingPkg(pkg);
    setName(pkg.name);
    setPrice(String(pkg.price));
    setSpeed(pkg.speed);
    setDescription(pkg.description);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (!name || !price || !speed) {
      setError('Nama, harga, dan kecepatan wajib diisi');
      setSaving(false);
      return;
    }

    try {
      const url = '/api/packages';
      const method = editingPkg ? 'PUT' : 'POST';
      const body = editingPkg
        ? { id: editingPkg._id, name, price: Number(price), speed, description }
        : { name, price: Number(price), speed, description };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan paket');
        return;
      }

      setDialogOpen(false);
      await fetchPackages();
    } catch {
      setError('Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const res = await fetch(`/api/packages?id=${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Gagal menghapus paket');
        return;
      }
      await fetchPackages();
    } catch {
      setError('Terjadi kesalahan saat menghapus');
    } finally {
      setDeleteId(null);
    }
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
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
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Paket</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola daftar paket internet</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Paket
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {packages.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <PackageIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada paket. Klik &quot;Tambah Paket&quot; untuk memulai.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <Card key={pkg._id} className="border-border/60 hover:border-border transition-colors group">
              <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <PackageIcon className="h-5 w-5" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(pkg)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(pkg._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold text-base">{pkg.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">{pkg.speed}</Badge>
                </div>
                <p className="text-2xl font-bold mt-3 tracking-tight">{formatRupiah(pkg.price)}</p>
                {pkg.description && (
                  <p className="text-xs text-muted-foreground mt-2">{pkg.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPkg ? 'Edit Paket' : 'Tambah Paket Baru'}</DialogTitle>
            <DialogDescription>
              {editingPkg ? 'Ubah data paket internet' : 'Isi detail paket internet baru'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pkg-name">Nama Paket</Label>
              <Input
                id="pkg-name"
                placeholder="Contoh: Paket 20 Mbps"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pkg-price">Harga (Rp)</Label>
                <Input
                  id="pkg-price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-speed">Kecepatan</Label>
                <Input
                  id="pkg-speed"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-desc">Deskripsi</Label>
              <Input
                id="pkg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Paket akan dihapus permanen.
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
    </div>
  );
}

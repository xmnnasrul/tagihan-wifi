'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2, Shield, UserPlus, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Admin {
  _id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentUsername, setCurrentUsername] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admins');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengambil data admin');
      setAdmins(data.admins);
      setCurrentUsername(data.currentUsername);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal mengambil data admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdmins();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat akun admin');
      setUsername('');
      setPassword('');
      toast.success('Akun pengguna berhasil dibuat');
      await fetchAdmins();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Gagal membuat akun admin');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password baru tidak cocok');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah password');
      toast.success(data.message);
      router.replace('/login');
    } catch (changeError) {
      toast.error(changeError instanceof Error ? changeError.message : 'Gagal mengubah password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggle = async (admin: Admin) => {
    const nextStatus = !admin.isActive;
    if (!nextStatus && !window.confirm(`Nonaktifkan akun ${admin.username}?`)) return;

    try {
      const response = await fetch('/api/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: admin._id, isActive: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah status admin');
      toast.success(data.message);
      await fetchAdmins();
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : 'Gagal mengubah status admin');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengelolaan Akun</h1>
        <p className="mt-1 text-sm text-muted-foreground">Atur akun admin dan pengguna operasional.</p>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      <section className="mx-auto w-full max-w-[700px] rounded-[28px] border border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.03] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-border/80 sm:p-6">
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-violet-500/10 bg-violet-500/[0.04] p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <UserPlus className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Akun baru</p>
            <h2 className="text-xl font-semibold">Tambah Pengguna</h2>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="admin-username" className="text-sm font-medium">Username</Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]+"
              className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="admin-password" className="text-sm font-medium">Password awal</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={10}
              className="h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
              required
            />
          </div>
          <div className="md:col-span-2 flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 sm:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Buat akun pengguna
            </Button>
          </div>
        </form>
      </section>

      <section className="mx-auto w-full max-w-[700px] rounded-[28px] border border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.03] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-border/80 sm:p-6">
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-violet-500/10 bg-violet-500/[0.04] p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Keamanan akun</p>
            <h2 className="text-xl font-semibold">Ganti Password Anda</h2>
          </div>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm font-medium">Password saat ini</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="pr-10 h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                aria-label={showCurrentPassword ? 'Sembunyikan password saat ini' : 'Tampilkan password saat ini'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-medium">Password baru</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  className="pr-10 h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
                  minLength={10}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-medium">Ulangi password baru</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  className="pr-10 h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
                  minLength={10}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={changingPassword} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 sm:w-auto">
              {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Ganti password
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Semua Akun</h2>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun admin...
          </div>
        ) : admins.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Tidak ada akun admin.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Akun</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin._id}>
                    <TableCell className="font-medium">
                      {admin.username}{admin.username === currentUsername ? ' (Anda)' : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.role === 'admin' ? 'default' : 'secondary'}>
                        {admin.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.isActive ? 'default' : 'secondary'}>
                        {admin.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(admin.createdAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={admin.username === currentUsername && admin.isActive}
                        onClick={() => void handleToggle(admin)}
                      >
                        {admin.isActive ? <UserRoundX className="mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
                        {admin.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
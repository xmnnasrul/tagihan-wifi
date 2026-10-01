'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2, Shield, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CurrentUser {
  username: string;
  role: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.replace('/login');
          return;
        }

        const data = await response.json();
        setCurrentUser(data.user ?? null);
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    void fetchCurrentUser();
  }, [router]);

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

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

      toast.success(data.message || 'Password berhasil diubah');
      router.replace('/login');
    } catch (changeError) {
      const message = changeError instanceof Error ? changeError.message : 'Gagal mengubah password';
      setError(message);
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Memuat profil...
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola akun Anda dan ubah password sesuai kebutuhan.</p>
      </div>

      <div className="mx-auto w-full max-w-[680px] rounded-[28px] border border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.03] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ring-1 ring-border/80 xl:p-7">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-violet-500/10 bg-violet-500/[0.04] p-3.5">
          <div>
            <p className="text-sm text-muted-foreground">Keamanan akun</p>
            <h2 className="text-2xl font-semibold tracking-tight">Ganti Password</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 shadow-inner shadow-violet-500/10">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-r from-muted/50 to-transparent p-3.5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-500/15 text-primary shadow-sm">
            <UserCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">{currentUser.username}</p>
            <Badge variant={currentUser.role === 'admin' ? 'default' : 'secondary'} className="mt-1 rounded-full px-2.5 py-0.5">
              {currentUser.role === 'admin' ? 'Admin' : 'User'}
            </Badge>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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
                placeholder="Masukkan password lama"
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

          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium">Password baru</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                className="pr-10 h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
                placeholder="Minimal 10 karakter"
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
            <Label htmlFor="confirm-password" className="text-sm font-medium">Konfirmasi password baru</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={10}
                className="pr-10 h-11 rounded-xl border-border/80 bg-background/80 shadow-sm focus-visible:ring-violet-500/30"
                placeholder="Ulangi password baru"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password baru' : 'Tampilkan konfirmasi password baru'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={changingPassword} className="min-w-[180px] rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500">
              {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Simpan Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

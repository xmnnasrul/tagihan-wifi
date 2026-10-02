'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Shield, UserCircle2 } from 'lucide-react';
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
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [changingUsername, setChangingUsername] = useState(false);
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
        setUsername(data.user?.username ?? '');
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    void fetchCurrentUser();
  }, [router]);

  const handleChangeUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    setChangingUsername(true);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengubah username');

      setUsername(data.username);
      setCurrentUser((user) => user ? { ...user, username: data.username } : user);
      window.dispatchEvent(new Event('profile-updated'));
      toast.success(data.message || 'Username berhasil diubah');
    } catch (renameError) {
      toast.error(renameError instanceof Error ? renameError.message : 'Gagal mengubah username');
    } finally {
      setChangingUsername(false);
    }
  };

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
        <p className="mt-1 text-sm text-muted-foreground">Kelola username dan password akun Anda.</p>
      </div>

      <div className="mx-auto w-full max-w-[680px] space-y-6 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Keamanan akun</p>
            <h2 className="text-2xl font-semibold tracking-tight">Ganti Password</h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">{currentUser.username}</p>
            <Badge variant={currentUser.role === 'admin' ? 'default' : 'secondary'} className="mt-1 rounded-full px-2.5 py-0.5">
              {currentUser.role === 'admin' ? 'Admin' : 'User'}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleChangeUsername} className="space-y-3 rounded-md border border-border bg-background/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="profile-username" className="text-sm font-medium">Username</Label>
            <Input
              id="profile-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9._-]+"
              className="h-11 focus-visible:ring-primary/30"
              required
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={changingUsername} className="w-full sm:w-auto">
              {changingUsername ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Simpan Username
            </Button>
          </div>
        </form>

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
                className="pr-10 h-11 focus-visible:ring-primary/30"
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
                className="pr-10 h-11 focus-visible:ring-primary/30"
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
                className="pr-10 h-11 focus-visible:ring-primary/30"
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
            <Button type="submit" disabled={changingPassword} className="min-w-[180px]">
              {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Simpan Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

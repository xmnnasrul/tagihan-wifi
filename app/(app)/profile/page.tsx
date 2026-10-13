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
  roles: string[];
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
        setCurrentUser(data.user ? { ...data.user, roles: Array.isArray(data.user.roles) ? data.user.roles : [data.user.role] } : null);
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

  const isAdmin = currentUser.roles.includes('admin');

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="grid min-h-[560px] md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/30 p-5 md:border-b-0 md:border-r" aria-label="Navigasi profil">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="text-lg font-semibold">{currentUser.username.slice(0, 1).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{currentUser.username}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {currentUser.roles.map((role) => (
                  <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                    {role === 'admin' ? 'Admin' : role === 'collector' ? 'Collector' : 'User'}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <nav className="mt-8 flex gap-1 md:flex-col" aria-label="Bagian profil">
            {isAdmin && (
              <a href="#account-details" className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                <UserCircle2 className="h-4 w-4" /> Informasi akun
              </a>
            )}
            <a href="#security-settings" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Shield className="h-4 w-4" /> Keamanan
            </a>
          </nav>
        </aside>

        <main className="min-w-0 p-5 sm:p-7">
          <header className="mb-7">
            <p className="text-sm text-muted-foreground">Pengaturan akun</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Profil & keamanan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? 'Kelola username dan password akun Anda.' : 'Kelola keamanan password akun Anda.'}
            </p>
          </header>

          <div className="max-w-3xl space-y-8">
            {isAdmin && (
              <section id="account-details" className="scroll-mt-6 space-y-4">
                <div className="border-b border-border pb-3">
                  <h2 className="text-base font-semibold">Informasi akun</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Username yang digunakan untuk masuk</p>
                </div>
                <form onSubmit={handleChangeUsername} className="space-y-3">
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
                      className="h-11 max-w-md focus-visible:ring-primary/30"
                      required
                    />
                  </div>
                  <div className="flex justify-start">
                    <Button type="submit" disabled={changingUsername}>
                      {changingUsername ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                      Simpan Username
                    </Button>
                  </div>
                </form>
              </section>
            )}

            <section id="security-settings" className="scroll-mt-6 space-y-5 border-t border-border pt-7">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Keamanan akun</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ganti password untuk menjaga keamanan akun.</p>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-sm font-medium">Password saat ini</Label>
                  <div className="relative max-w-md">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                      className="h-11 pr-10 focus-visible:ring-primary/30"
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
                  <div className="relative max-w-md">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={10}
                      className="h-11 pr-10 focus-visible:ring-primary/30"
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
                  <div className="relative max-w-md">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={10}
                      className="h-11 pr-10 focus-visible:ring-primary/30"
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

                <div className="flex justify-start pt-1">
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Simpan Password
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

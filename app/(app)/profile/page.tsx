'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Shield } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProfileImageEditor from '@/components/ProfileImageEditor';
import { useCurrentUser, useCurrentUserLoading } from '@/components/CurrentUserProvider';

interface CurrentUser {
  id: string;
  username: string;
  role: string;
  roles: string[];
  profileImage: string;
  hasOriginalProfileImage: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const sharedUser = useCurrentUser();
  const currentUserLoading = useCurrentUserLoading();
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
    if (currentUserLoading) return;
    if (!sharedUser) {
      router.replace('/login');
      setLoading(false);
      return;
    }

    setCurrentUser({
      id: sharedUser.id,
      username: sharedUser.username,
      role: sharedUser.role,
      roles: sharedUser.roles,
      profileImage: sharedUser.profileImage,
      hasOriginalProfileImage: sharedUser.hasOriginalProfileImage,
    });
    setUsername(sharedUser.username);
    setLoading(false);
  }, [currentUserLoading, router, sharedUser]);

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
      <div className="space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pengaturan akun</p>
        </header>
        <div className="flex min-h-28 items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat data profil...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const isAdmin = currentUser.roles.some((role) => role === 'admin' || role === 'superadmin');

  return (
    <div className="mx-auto max-w-6xl space-y-7 sm:space-y-9">
      <header>
        <h1 className="text-2xl font-semibold">Profil akun</h1>
        <p className="mt-1 text-sm text-muted-foreground">Identitas dan akses akun admin</p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
        <aside className="space-y-5 lg:sticky lg:top-16">
          {isAdmin ? (
            <ProfileImageEditor
              username={currentUser.username}
              profileImage={currentUser.profileImage}
              hasOriginalPhoto={currentUser.hasOriginalProfileImage}
              onUpdated={(profileImage, hasOriginalPhoto) => setCurrentUser((user) => user ? {
                ...user,
                profileImage,
                hasOriginalProfileImage: Boolean(hasOriginalPhoto),
              } : user)}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {currentUser.profileImage
                ? <Image src={currentUser.profileImage} alt={`Foto profil ${currentUser.username}`} width={80} height={80} unoptimized className="h-20 w-20 rounded-full object-cover" />
                : <span className="text-2xl font-semibold">{currentUser.username.slice(0, 1).toUpperCase()}</span>}
            </div>
          )}
          <div className="space-y-2">
            <p className="break-all text-lg font-semibold">{currentUser.username}</p>
            <div className="flex flex-wrap gap-1.5">
              {currentUser.roles.map((role) => (
                <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                  {role === 'superadmin' ? 'Superadmin' : 'Admin'}
                </Badge>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Akun ini digunakan untuk masuk dan mengelola operasional Tagihan WiFi.</p>
        </aside>

        <div className="min-w-0 space-y-9">
          {isAdmin && (
            <section id="account-details" className="space-y-6" aria-labelledby="profile-details-heading">
              <header>
                <h2 id="profile-details-heading" className="text-lg font-semibold">Informasi akun</h2>
                <p className="mt-1 text-sm text-muted-foreground">Perbarui username yang digunakan untuk masuk.</p>
              </header>

              <form onSubmit={handleChangeUsername} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    minLength={3}
                    maxLength={32}
                    pattern="[a-zA-Z0-9._-]+"
                    className="h-11"
                    required
                  />
                  <p className="text-xs text-muted-foreground">3-32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.</p>
                </div>
                <Button type="submit" disabled={changingUsername || username === currentUser.username} className="sm:min-w-40">
                  {changingUsername ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                  Simpan username
                </Button>
              </form>

            </section>
          )}

          <section id="security-settings" className="space-y-5 border-t border-border/70 pt-6" aria-labelledby="security-heading">
            <header>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 id="security-heading" className="text-lg font-semibold">Keamanan akun</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Gunakan password baru yang berbeda dari password saat ini.</p>
            </header>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <form onSubmit={handleChangePassword} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="current-password">Password saat ini</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    className="h-11 pr-10"
                    placeholder="Masukkan password lama"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} aria-label={showCurrentPassword ? 'Sembunyikan password saat ini' : 'Tampilkan password saat ini'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">Password baru</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    className="h-11 pr-10"
                    placeholder="Minimal 10 karakter"
                    required
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="confirm-password">Konfirmasi password baru</Label>
                <div className="relative sm:max-w-[calc(50%-0.5rem)]">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={10}
                    className="h-11 pr-10"
                    placeholder="Ulangi password baru"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password baru' : 'Tampilkan konfirmasi password baru'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Simpan password
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

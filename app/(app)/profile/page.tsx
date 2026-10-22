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
import { Textarea } from '@/components/ui/textarea';
import ProfileImageEditor from '@/components/ProfileImageEditor';

interface CurrentUser {
  id: string;
  username: string;
  role: string;
  roles: string[];
  profileImage: string;
  hasOriginalProfileImage: boolean;
  bio: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [changingUsername, setChangingUsername] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
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
        setCurrentUser(data.user ? {
          ...data.user,
          id: data.user.id || '',
          profileImage: data.user.profileImage || '',
          hasOriginalProfileImage: Boolean(data.user.hasOriginalProfileImage),
          bio: data.user.bio || '',
          roles: Array.isArray(data.user.roles) ? data.user.roles : [data.user.role],
        } : null);
        setUsername(data.user?.username ?? '');
        setBio(data.user?.bio ?? '');
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

  const handleSaveBio = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingBio(true);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan bio');
      setBio(data.bio || '');
      setCurrentUser((user) => user ? { ...user, bio: data.bio || '' } : user);
      toast.success(data.message || 'Bio berhasil diperbarui');
    } catch (bioError) {
      toast.error(bioError instanceof Error ? bioError.message : 'Gagal menyimpan bio');
    } finally {
      setSavingBio(false);
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

  const isAdmin = currentUser.roles.some((role) => role === 'admin' || role === 'superadmin');

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-1 sm:space-y-8 sm:px-0">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pb-6">
        <div>
          <p className="text-sm text-muted-foreground">Pengaturan akun</p>
          <h1 className="mt-1 text-2xl font-bold">Profil</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {currentUser.roles.map((role) => (
              <Badge key={role} variant={role === 'admin' ? 'default' : 'secondary'}>
                {role === 'superadmin' ? 'Superadmin' : 'Admin'}
              </Badge>
            ))}
          </div>
        </div>
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
          <div className="flex items-center gap-3">
            {currentUser.profileImage ? <Image src={currentUser.profileImage} alt={`Foto profil ${currentUser.username}`} width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><span className="text-lg font-semibold">{currentUser.username.slice(0, 1).toUpperCase()}</span></div>}
            <p className="font-semibold">{currentUser.username}</p>
          </div>
        )}
      </header>

      <div className={`grid gap-6 sm:gap-8 ${isAdmin ? 'lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-12' : 'max-w-2xl'}`}>
        {isAdmin && <div className="space-y-7 sm:space-y-8">
          <section id="account-details" className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">Informasi profil</h2>
              <p className="mt-1 text-sm text-muted-foreground">Informasi singkat yang ditampilkan pada akun Anda.</p>
            </div>

            <form onSubmit={handleSaveBio} className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="profile-bio">Bio</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{bio.length}/160</span>
              </div>
              <Textarea
                id="profile-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={160}
                rows={4}
                placeholder="Ceritakan sedikit tentang diri Anda"
                className="min-h-24 resize-y"
              />
              <Button type="submit" variant="outline" disabled={savingBio || bio === currentUser.bio}>
                {savingBio && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Bio
              </Button>
            </form>

            <form onSubmit={handleChangeUsername} className="space-y-3.5 border-t border-border pt-5">
              <div>
                <Label htmlFor="profile-username">Username</Label>
                <p className="mt-1 text-sm text-muted-foreground">Username yang digunakan untuk masuk.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <Button type="submit" disabled={changingUsername} className="shrink-0">
                  {changingUsername ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                  Simpan Username
                </Button>
              </div>
            </form>
          </section>
        </div>}

        <section id="security-settings" className={`space-y-5 ${isAdmin ? 'border-t border-border pt-6 sm:pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Keamanan akun</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ganti password untuk menjaga keamanan akun.</p>
            </div>
          </div>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <form onSubmit={handleChangePassword} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi password baru</Label>
              <div className="relative">
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

            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Simpan Password
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, User, Lock, Loader2, AlertCircle, Eye, EyeOff, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login gagal');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] bg-background lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
      <section className="flex min-h-56 flex-col justify-between bg-primary px-6 py-6 text-primary-foreground sm:min-h-64 sm:px-10 sm:py-8 lg:min-h-[100dvh] lg:px-14 lg:py-12">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary-foreground/25">
            <Wifi className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">Tagihan WiFi</span>
        </div>
        <div className="max-w-xl py-10 lg:py-0">
          <h1 className="max-w-lg text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">Administrasi jaringan, lebih teratur.</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-primary-foreground/80 sm:text-base">
            Kelola pelanggan, tagihan, dan setoran WiFi dalam satu ruang kerja.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-primary-foreground/75 lg:flex">
          <Network className="h-4 w-4" />
          <span>Operasional pelanggan dan pembayaran</span>
        </div>
      </section>

      <section className="relative flex min-h-[540px] items-center justify-center px-5 py-12 sm:px-10 lg:min-h-[100dvh]">
        <div className="absolute right-4 top-4 sm:right-8 sm:top-8">
          <ThemeToggle showLabel={false} size="icon" />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-sm font-medium text-primary">Selamat datang</p>
            <h2 className="mt-2 text-2xl font-semibold">Masuk ke akun</h2>
            <p className="mt-2 text-sm text-muted-foreground">Gunakan akun admin untuk melanjutkan.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-11 pl-10"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 pl-10 pr-11"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-11 w-full justify-between px-4">
              <span>{loading ? 'Memeriksa akun...' : 'Masuk'}</span>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden="true">&rarr;</span>}
            </Button>
          </form>
          <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">Tagihan WiFi · Panel administrasi</p>
        </div>
      </section>
    </main>
  );
}

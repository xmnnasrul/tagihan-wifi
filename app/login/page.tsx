'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ThemeToggle from '@/components/ThemeToggle';
import { loginSchema } from '@/lib/login-validation';

export default function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSubmitting = useRef(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting.current) return;
    setError('');

    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      setError('Username atau password tidak valid.');
      return;
    }

    isSubmitting.current = true;
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login gagal');
        return;
      }

      router.replace('/dashboard');
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-[#b9d8d2] text-[#123a3c] dark:bg-[#0b292b] dark:text-[#eef4eb]">
      <header className="mx-auto flex w-full max-w-360 items-center justify-end px-5 py-4 sm:px-8 lg:px-12">
        <ThemeToggle
          showLabel={false}
          size="icon"
          className="text-[#123a3c] hover:bg-[#a8ccc5] dark:text-[#eaf2ef] dark:hover:bg-white/10"
        />
      </header>

      <main className="mx-auto flex w-full max-w-295 flex-1 items-center px-4 py-6 sm:px-8 sm:py-8 xl:px-0">
        <motion.div
          initial={prefersReducedMotion ? false : { y: 24, rotate: -0.55, scale: 0.985 }}
          animate={{ y: 0, rotate: 0, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 95, damping: 18, mass: 0.85 }}
          className="login-motion-initial login-paper-shell mx-auto w-full max-w-295"
        >
          <div className="login-paper grid w-full grid-cols-1 gap-10 bg-[#eef4e9] py-10 pl-10 pr-16 text-[#123a3c] dark:bg-[#153b3d] dark:text-[#eef4eb] sm:gap-14 sm:py-14 sm:pl-16 sm:pr-20 md:grid-cols-[0.95fr_1.05fr] md:items-center md:gap-8 lg:gap-20 lg:py-16 lg:pl-20 lg:pr-24">
            <motion.section
              aria-labelledby="intro-title"
              initial={prefersReducedMotion ? false : { y: 12 }}
              animate={{ y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.42, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="login-intro login-motion-initial flex flex-col justify-center"
            >
            <h1 id="intro-title" className="max-w-120 text-[clamp(1.75rem,2.4vw,2rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
              Dari pelanggan sampai setoran.
            </h1>
            <p className="mt-6 max-w-107.5 text-base leading-7 text-[#476465] dark:text-[#bed3cb]">
              Tagihan, pembayaran, dan kunjungan lapangan tersambung dalam satu catatan.
            </p>
            </motion.section>

            <motion.section
              aria-labelledby="login-title"
              initial={prefersReducedMotion ? false : { y: 12 }}
              animate={{ y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.42, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="login-form-panel login-motion-initial flex flex-col justify-center lg:py-8"
            >
            <div className="mb-8">
              <h2 id="login-title" className="text-3xl font-semibold tracking-[-0.04em]">Login</h2>
              <p className="mt-2 text-sm leading-6 text-[#476465] dark:text-[#bed3cb]">
                Akses panel operasional Tagihan WiFi.
              </p>
            </div>

            <form onSubmit={handleSubmit} aria-labelledby="login-title" className="space-y-6">
              <div className="login-scroll-reveal space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-12 rounded-none border-0 border-b-2 border-[#a7c3bb] bg-transparent px-0 text-base text-[#123a3c] placeholder:text-[#647b77] focus-visible:border-[#168697] focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-[#456c69] dark:text-[#f1f5ed] dark:placeholder:text-[#a9c1b9] dark:focus-visible:border-[#45bee3]"
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9._-]+"
                  title="Gunakan 3-32 karakter: huruf, angka, titik, garis bawah, atau tanda hubung."
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                />
              </div>

              <div className="login-scroll-reveal login-scroll-reveal--later space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-none border-0 border-b-2 border-[#a7c3bb] bg-transparent px-0 pr-12 text-base text-[#123a3c] placeholder:text-[#647b77] focus-visible:border-[#168697] focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-[#456c69] dark:text-[#f1f5ed] dark:placeholder:text-[#a9c1b9] dark:focus-visible:border-[#45bee3]"
                    minLength={1}
                    maxLength={72}
                    required
                    autoComplete="current-password"
                    enterKeyHint="done"
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-[#476465] outline-none transition-colors hover:text-[#123a3c] focus-visible:ring-2 focus-visible:ring-[#168697] dark:text-[#bed3cb] dark:hover:text-white dark:focus-visible:ring-[#45bee3]"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={showPassword ? 'hidden' : 'visible'}
                        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.12 }}
                      >
                        {showPassword
                          ? <EyeOff aria-hidden="true" className="h-4 w-4" />
                          : <Eye aria-hidden="true" className="h-4 w-4" />}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key="login-error"
                    role="alert"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
                    className="flex items-start gap-2.5 border-l-4 border-red-700 bg-red-100 px-3.5 py-3 text-sm text-red-900 dark:border-red-300 dark:bg-red-950 dark:text-red-100"
                  >
                    <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={prefersReducedMotion || loading ? undefined : { y: -1 }}
                whileTap={prefersReducedMotion || loading ? undefined : { scale: 0.99 }}
                transition={{ duration: 0.14 }}
                className="login-scroll-reveal login-scroll-reveal--later flex h-14 w-full items-center justify-center bg-[#123f43] px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0d3437] focus-visible:ring-2 focus-visible:ring-[#168697] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef4e9] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#45bee3] dark:text-[#102b2d] dark:hover:bg-[#73d2eb] dark:focus-visible:ring-[#45bee3] dark:focus-visible:ring-offset-[#153b3d]"
              >
                {loading ? (
                  <>
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    Memeriksa akun...
                  </>
                ) : 'Login'}
              </motion.button>
            </form>
            </motion.section>

          </div>
        </motion.div>
      </main>
    </div>
  );
}

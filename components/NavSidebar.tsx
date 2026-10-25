'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Wifi, LayoutDashboard, FilePlus, Package, Archive, Download, LogOut, History, Shield, Users, UserCircle2, FileText, WalletCards, MoreHorizontal, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useCurrentUser } from '@/components/CurrentUserProvider';
import { getScheduledTheme, THEME_PREFERENCE_KEY } from '@/components/ThemeProvider';

const navGroups = [
  { label: 'Ringkasan', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Operasional', items: [
    { href: '/customers/all', label: 'Pelanggan', icon: Users },
    { href: '/collector', label: 'Setoran Harian', icon: WalletCards },
    { href: '/arrears', label: 'Tunggakan', icon: FileText },
    { href: '/billing/add', label: 'Tambah Tagihan', icon: FilePlus },
  ] },
  { label: 'Data', items: [
    { href: '/packages', label: 'Paket Internet', icon: Package },
    { href: '/archived', label: 'Arsip Pelanggan', icon: Archive },
    { href: '/export', label: 'Ekspor Data', icon: Download },
  ] },
  { label: 'Pengawasan', items: [
    { href: '/audit', label: 'Log Aktivitas', icon: History },
    { href: '/admins', label: 'Pengelolaan Admin', icon: Shield },
  ] },
  { label: 'Akun', items: [{ href: '/profile', label: 'Profil', icon: UserCircle2 }] },
];

const mobileNav = [
  { href: '/dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { href: '/customers/all', label: 'Pelanggan', icon: Users },
  { href: '/collector', label: 'Setoran', icon: WalletCards },
  { href: '/arrears', label: 'Tunggakan', icon: FileText },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const currentUser = useCurrentUser();
  const username = currentUser?.username || '';
  const roles = currentUser?.roles || [];
  const isSuperadmin = roles.includes('superadmin');
  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.href !== '/admins' || isSuperadmin),
  })).filter((group) => group.items.length > 0);
  const activeItem = visibleGroups.flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    setTheme(getScheduledTheme());
    window.localStorage.removeItem(THEME_PREFERENCE_KEY);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const NavContent = () => (
    <>
      <div className="px-5 pb-5 pt-6">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wifi className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold">Tagihan WiFi</h1>
            <p className="text-xs text-muted-foreground">Administrasi jaringan</p>
          </div>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4" aria-label="Navigasi utama">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                      isActive ? 'bg-foreground/[0.06] font-medium text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
                    )}
                  >
                    <motion.span whileHover={prefersReducedMotion ? undefined : { y: -1 }} className={cn(isActive ? 'text-primary' : 'text-muted-foreground')}>
                      <Icon className="h-4 w-4" />
                    </motion.span>
                    <span>{item.label}</span>
                    {isActive && <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3 pt-2">
        <ThemeToggle className="mb-3 w-full justify-start text-muted-foreground hover:text-foreground" />
        <div className="flex items-center justify-between gap-2 overflow-hidden rounded-md border border-border/70 bg-card/70 px-2.5 py-2">
          <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex min-w-0 items-center gap-2 text-sm font-medium hover:text-primary">
            <UserCircle2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate" title={username || 'Admin'}>{username || 'Admin'}</span>
            <span className="sr-only">Profil</span>
          </Link>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="shrink-0 justify-start gap-2 px-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden xl:inline">Keluar</span>
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-y-auto bg-[hsl(var(--chrome))] lg:flex">
        {NavContent()}
      </aside>

      <div className="fixed left-64 right-0 top-0 z-30 hidden h-12 items-center justify-between bg-[hsl(var(--chrome))] px-6 lg:flex">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tagihan WiFi</span>
          <span aria-hidden="true" className="text-muted-foreground/60">/</span>
          <span className="font-medium">{activeItem?.label || 'Dashboard'}</span>
        </div>
        <span className="max-w-48 truncate text-sm text-muted-foreground" title={username || 'Admin'}>
          {username || 'Admin'}
        </span>
      </div>

      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b border-border/70 bg-background px-4 lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
          <Wifi className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">{activeItem?.label || 'Tagihan WiFi'}</span>
        </Link>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navigasi cepat">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
              className={cn('flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
          className={cn('h-full flex-col gap-1 rounded-none px-1 text-[10px] font-medium', mobileOpen ? 'text-primary' : 'text-muted-foreground')}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
          Menu
        </Button>
      </nav>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/35 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Semua menu"
              className="absolute inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] flex max-h-[75dvh] flex-col overflow-hidden overscroll-contain rounded-t-lg bg-background pb-3 shadow-xl"
              initial={prefersReducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto my-2 h-1 w-10 rounded-full bg-muted-foreground/35" />
              {NavContent()}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

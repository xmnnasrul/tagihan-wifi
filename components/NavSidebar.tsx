'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Wifi, LayoutDashboard, FilePlus, Package, Archive, Download, LogOut, History, Shield, Users, UserCircle2, FileText, WalletCards, MoreHorizontal, ArrowUpRight, StickyNote, MessageCircle, CalendarDays, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useCurrentUser } from '@/components/CurrentUserProvider';
import { getScheduledTheme, THEME_PREFERENCE_KEY } from '@/components/ThemeProvider';

const navGroups = [
  { label: 'Ringkasan', items: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/monthly-recap', label: 'Rekap Bulanan', icon: CalendarDays },
  ] },
  { label: 'Operasional', items: [
    { href: '/customers/all', label: 'Pelanggan', icon: Users },
    { href: '/collector', label: 'Setoran Harian', icon: WalletCards },
    { href: '/arrears', label: 'Tunggakan', icon: FileText },
    { href: '/cek-nota', label: 'Cek Nota', icon: ScanLine },
    { href: '/chat', label: 'Chat AI', icon: MessageCircle },
    { href: '/notes', label: 'Catatan', icon: StickyNote },
    { href: '/billing/add', label: 'Tambah Pelanggan', icon: FilePlus },
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

const desktopNav = [
  { href: '/dashboard', label: 'Ringkasan' },
  { href: '/customers/all', label: 'Pelanggan' },
  { href: '/collector', label: 'Setoran' },
  { href: '/arrears', label: 'Tunggakan' },
  { href: '/monthly-recap', label: 'Rekap' },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [isScrolling, setIsScrolling] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [isLogoFocused, setIsLogoFocused] = useState(false);
  const [isLogoPressed, setIsLogoPressed] = useState(false);
  const scrollResetTimeout = useRef<number | null>(null);
  const logoResetTimeout = useRef<number | null>(null);
  const { scrollY } = useScroll();
  const currentUser = useCurrentUser();
  const username = currentUser?.username || '';
  const roles = currentUser?.roles || [];
  const isSuperadmin = roles.includes('superadmin');
  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.href !== '/admins' || isSuperadmin),
  })).filter((group) => group.items.length > 0);
  const desktopNavHrefs = new Set(desktopNav.map((item) => item.href));
  const desktopMoreGroups = visibleGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !desktopNavHrefs.has(item.href) && item.href !== '/profile'),
  })).filter((group) => group.items.length > 0);
  const activeItem = visibleGroups.flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useMotionValueEvent(scrollY, 'change', (latest) => {
    if (scrollResetTimeout.current !== null) {
      window.clearTimeout(scrollResetTimeout.current);
    }

    if (latest <= 0) {
      setIsScrolling(false);
      scrollResetTimeout.current = null;
      return;
    }

    setIsScrolling(true);
    scrollResetTimeout.current = window.setTimeout(() => {
      setIsScrolling(false);
      scrollResetTimeout.current = null;
    }, 160);
  });

  useEffect(() => {
    return () => {
      if (scrollResetTimeout.current !== null) {
        window.clearTimeout(scrollResetTimeout.current);
      }
      if (logoResetTimeout.current !== null) {
        window.clearTimeout(logoResetTimeout.current);
      }
    };
  }, []);

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

  const isCompact = isScrolling && !isLogoHovered && !isLogoFocused && !isLogoPressed;

  const startLogoPress = () => {
    if (logoResetTimeout.current !== null) {
      window.clearTimeout(logoResetTimeout.current);
      logoResetTimeout.current = null;
    }
    setIsLogoPressed(true);
  };

  const releaseLogoAfterPress = () => {
    if (logoResetTimeout.current !== null) {
      window.clearTimeout(logoResetTimeout.current);
    }
    logoResetTimeout.current = window.setTimeout(() => {
      setIsLogoPressed(false);
      logoResetTimeout.current = null;
    }, 650);
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
                      isActive ? 'bg-foreground/6 font-medium text-foreground' : 'text-muted-foreground hover:bg-foreground/4 hover:text-foreground'
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
      <header className="fixed inset-x-0 top-3 z-40 hidden justify-center px-3 min-[60rem]:flex">
        <motion.div
          layout
          animate={{ opacity: isCompact ? 0.5 : 1 }}
          transition={prefersReducedMotion
            ? { layout: { duration: 0 }, opacity: { duration: 0 } }
            : {
                layout: { type: 'spring', stiffness: 520, damping: 38, mass: 0.5 },
                  opacity: { duration: 0.14, ease: 'easeOut' },
              }}
          className={cn(
            'flex max-w-full items-center whitespace-nowrap rounded-full border border-border/80 bg-background p-1',
            isCompact ? 'gap-0' : 'gap-0.5'
          )}
        >
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-2 rounded-full px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Tagihan WiFi, Dashboard"
            onPointerEnter={(event) => {
              if (event.pointerType !== 'touch') setIsLogoHovered(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch') setIsLogoHovered(false);
            }}
            onPointerDown={startLogoPress}
            onPointerUp={releaseLogoAfterPress}
            onPointerCancel={() => setIsLogoPressed(false)}
            onFocus={() => setIsLogoFocused(true)}
            onBlur={() => setIsLogoFocused(false)}
            onClick={releaseLogoAfterPress}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Wifi className="h-4 w-4" aria-hidden="true" />
            </span>
            <AnimatePresence initial={false}>
              {!isCompact && (
                <motion.span
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -6 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.12, ease: 'easeOut' }}
                  className="hidden text-sm font-semibold min-[60rem]:inline"
                >
                  Tagihan WiFi
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <motion.div
            initial={false}
            animate={{
              width: isCompact ? 0 : 'auto',
              opacity: isCompact ? 0 : 1,
              x: isCompact ? 8 : 0,
              scale: isCompact ? 0.98 : 1,
            }}
            transition={prefersReducedMotion
              ? { duration: 0 }
              : {
                  width: { type: 'spring', stiffness: 540, damping: 38, mass: 0.5 },
                  opacity: { duration: 0.14, ease: 'easeOut' },
                  x: { type: 'spring', stiffness: 540, damping: 38, mass: 0.5 },
                  scale: { type: 'spring', stiffness: 540, damping: 38, mass: 0.5 },
                }}
            aria-hidden={isCompact}
            {...({ inert: isCompact } as any)}
            className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-hidden"
          >
            <nav className="flex shrink-0 items-center gap-0.5" aria-label="Navigasi utama">
              {desktopNav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:px-3',
                      isActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-active-pill"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-full bg-primary/10"
                        transition={prefersReducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 560, damping: 38, mass: 0.5 }}
                      />
                    )}
                    <span className="relative">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {desktopMoreGroups.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Lainnya"
                    className="ml-1 h-11 gap-1.5 rounded-full px-2.5 text-sm text-muted-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden min-[60rem]:inline">Lainnya</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 rounded-xl p-2">
                  <nav aria-label="Navigasi lainnya" className="max-h-[min(70dvh,32rem)] space-y-3 overflow-y-auto">
                    {desktopMoreGroups.map((group) => (
                      <div key={group.label}>
                        <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</p>
                        <ul className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  aria-current={isActive ? 'page' : undefined}
                                  className={cn(
                                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                  )}
                                >
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                  {item.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </nav>
                </PopoverContent>
              </Popover>
            )}

            <ThemeToggle showLabel={false} className="h-11 w-11 rounded-full p-0" />
            <Link
              href="/profile"
              title={username || 'Profil'}
              aria-label={username ? `Profil ${username}` : 'Profil'}
              className="inline-flex h-11 max-w-36 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden truncate xl:inline">{username || 'Admin'}</span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Keluar"
              title="Keluar"
              onClick={handleLogout}
              className="h-11 w-11 rounded-full text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </Button>
          </motion.div>
        </motion.div>
      </header>

      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b border-border/70 bg-background px-4 min-[60rem]:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
          <Wifi className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">{activeItem?.label || 'Tagihan WiFi'}</span>
        </Link>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border/70 bg-background pb-[env(safe-area-inset-bottom)] min-[60rem]:hidden" aria-label="Navigasi cepat">
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
              <Icon className="h-4.5 w-4.5" />
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
          <MoreHorizontal className="h-4.5 w-4.5" />
          Menu
        </Button>
      </nav>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/35 min-[60rem]:hidden"
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

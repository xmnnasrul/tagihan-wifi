'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Wifi, LayoutDashboard, FilePlus, Package, Archive, Download, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/billing/add', label: 'Tambah Tagihan', icon: FilePlus },
  { href: '/packages', label: 'Manajemen Paket', icon: Package },
  { href: '/archived', label: 'Arsip', icon: Archive },
  { href: '/export', label: 'Ekspor Data', icon: Download },
];

export default function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const NavContent = () => (
    <>
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">WiFi Billing</h1>
            <p className="text-xs text-muted-foreground">Manajemen Tagihan</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card/50 backdrop-blur-sm fixed inset-y-0 left-0 z-40">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Wifi className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">TAGIHAN</span>
          </Link>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}

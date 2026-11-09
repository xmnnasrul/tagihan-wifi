'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, RotateCcw, ScanLine, Search } from 'lucide-react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

interface Customer {
  _id: string;
  name: string;
  address: string;
  packageId: { name: string; price: number } | null;
}

function ReceiptScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    const receipt = new THREE.Group();
    scene.add(receipt);

    const paper = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 2.75, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf1f6f3, roughness: 0.8 })
    );
    receipt.add(paper);

    const teal = new THREE.MeshStandardMaterial({ color: 0x167b78, roughness: 0.7 });
    const ink = new THREE.MeshStandardMaterial({ color: 0xaabbb6, roughness: 0.9 });
    const coral = new THREE.MeshStandardMaterial({ color: 0xe58965, roughness: 0.65 });

    const bars = [
      { x: -0.42, y: 0.82, width: 0.9, material: teal },
      { x: -0.43, y: 0.4, width: 1.18, material: ink },
      { x: -0.43, y: 0.12, width: 1.18, material: ink },
      { x: -0.43, y: -0.16, width: 0.78, material: ink },
      { x: -0.43, y: -0.65, width: 1.18, material: ink },
      { x: -0.43, y: -0.93, width: 0.72, material: ink },
    ];
    bars.forEach(({ x, y, width, material }) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.075, 0.035), material);
      bar.position.set(x, y, 0.085);
      receipt.add(bar);
    });

    const scanLine = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.045, 0.045), coral);
    scanLine.position.set(0, 0.95, 0.14);
    receipt.add(scanLine);

    scene.add(new THREE.AmbientLight(0xffffff, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(-3, 4, 6);
    scene.add(keyLight);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frame = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      receipt.rotation.y = Math.sin(elapsed * 0.45) * 0.13;
      receipt.rotation.z = Math.sin(elapsed * 0.35) * 0.025;
      receipt.position.y = Math.sin(elapsed * 0.6) * 0.04;
      scanLine.position.y = 0.95 - ((elapsed * 0.55) % 1.9);
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    if (prefersReducedMotion) {
      renderer.render(scene, camera);
    } else {
      frame = window.requestAnimationFrame(animate);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [prefersReducedMotion]);

  return <div ref={mountRef} className="h-28 w-full sm:h-36" aria-hidden="true" />;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CekNotaPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let active = true;

    async function fetchCustomers() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/customers', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(data.error || 'Gagal memuat data pelanggan');
        }
        if (active) setCustomers(data as Customer[]);
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat data pelanggan');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchCustomers();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const visibleCustomers = useMemo(() => {
    const villageSearch = search.trim().toLocaleLowerCase('id-ID');
    if (!villageSearch) return [];
    return customers.filter((customer) => (customer.address || '').toLocaleLowerCase('id-ID').includes(villageSearch));
  }, [customers, search]);

  const checkedCustomers = visibleCustomers.filter((customer) => selectedIds.has(customer._id));
  const totalAmount = checkedCustomers.reduce((total, customer) => total + (Number(customer.packageId?.price) || 0), 0);
  const enterAnimation = prefersReducedMotion ? false : { opacity: 0, y: 8 };

  const toggleCustomer = (customerId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(customerId);
      else next.delete(customerId);
      return next;
    });
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    setSelectedIds(new Set());
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.header
        initial={enterAnimation}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: 'easeOut' }}
        className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_190px] sm:gap-6"
      >
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <ScanLine className="h-4 w-4" />
            Pencocokan tagihan
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Cek Nota</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pencocokan nota dengan data.
          </p>
        </div>
        <div className="hidden sm:block">
          <ReceiptScene />
        </div>
      </motion.header>

      <section aria-label="Cari alamat" className="space-y-2">
        <label htmlFor="address-search" className="text-sm font-medium">Cari alamat</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="address-search"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Cari alamat pelanggan"
            className="h-11 pl-10"
            autoComplete="off"
          />
        </div>
      </section>

      <section
        className="sticky top-14 z-20 grid grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] gap-2 bg-background/95 py-2.5 backdrop-blur sm:gap-3"
        aria-label="Ringkasan pencocokan"
        aria-live="polite"
      >
        <div className="relative min-w-0 overflow-hidden rounded-md border border-primary/20 bg-primary/5 px-2 py-2 sm:px-3">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" />
          <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs">Pelanggan ditemukan</p>
          <motion.p key={visibleCustomers.length} initial={enterAnimation} animate={{ opacity: 1, y: 0 }} className="truncate text-base font-semibold tabular-nums text-primary sm:text-lg">
            {loading ? '–' : visibleCustomers.length}
          </motion.p>
        </div>
        <div className="relative min-w-0 overflow-hidden rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-2 sm:px-3">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-emerald-600 dark:bg-emerald-400" />
          <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs">Sudah dicentang</p>
          <motion.p key={checkedCustomers.length} initial={enterAnimation} animate={{ opacity: 1, y: 0 }} className="truncate text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-lg">
            {checkedCustomers.length}
          </motion.p>
        </div>
        <div className="relative min-w-0 overflow-hidden rounded-md border border-orange-500/20 bg-orange-500/5 px-2 py-2 sm:px-3">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-orange-600 dark:bg-orange-400" />
          <p className="text-[10px] leading-4 text-muted-foreground sm:text-xs">Total uang</p>
          <motion.p key={totalAmount} initial={enterAnimation} animate={{ opacity: 1, y: 0 }} className="truncate text-xs font-semibold tabular-nums text-orange-700 dark:text-orange-400 sm:text-lg">
            {formatRupiah(totalAmount)}
          </motion.p>
        </div>
      </section>

      <section aria-label="Daftar pelanggan" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Daftar pelanggan</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={checkedCustomers.length === 0}
            className="shrink-0 gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset centang
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
          <div className="grid grid-cols-[36px_48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground sm:grid-cols-[52px_72px_minmax(0,1fr)_minmax(150px,1fr)_170px]">
            <span className="text-right">No.</span>
            <span className="text-center">Cek</span>
            <span>Nama pelanggan</span>
            <span className="hidden sm:block">Alamat</span>
            <span className="text-right">Nominal</span>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat pelanggan...
            </div>
          ) : error ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>Coba lagi</Button>
            </div>
          ) : !search.trim() ? (
            <div className="px-4 py-12 text-center">
              <Search className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Cari alamat untuk mulai</p>
              <p className="mt-1 text-xs text-muted-foreground">Pelanggan akan dicocokkan berdasarkan alamatnya.</p>
            </div>
          ) : visibleCustomers.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium">Tidak ada pelanggan yang ditemukan</p>
              <p className="mt-1 text-xs text-muted-foreground">Periksa ejaan alamat atau coba kata lain.</p>
            </div>
          ) : (
            <div>
              {visibleCustomers.map((customer, index) => (
                <motion.div
                  key={customer._id}
                  layout={!prefersReducedMotion}
                  initial={enterAnimation}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.18, delay: prefersReducedMotion ? 0 : Math.min(index, 6) * 0.025 }}
                  className="grid grid-cols-[36px_48px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:grid-cols-[52px_72px_minmax(0,1fr)_minmax(150px,1fr)_170px]"
                >
                  <span className="text-right text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                  <div className="flex justify-center">
                    <Checkbox
                      id={`receipt-${customer._id}`}
                      checked={selectedIds.has(customer._id)}
                      onCheckedChange={(checked) => toggleCustomer(customer._id, checked === true)}
                      aria-label={`Tandai ${customer.name}`}
                    />
                  </div>
                  <label htmlFor={`receipt-${customer._id}`} className="min-w-0 cursor-pointer">
                    <span className="block truncate text-sm font-medium">{customer.name}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground sm:hidden">{customer.address || 'Alamat belum diisi'}</span>
                  </label>
                  <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">{customer.address || 'Alamat belum diisi'}</span>
                  <span className="text-right text-sm font-medium tabular-nums">{formatRupiah(Number(customer.packageId?.price) || 0)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Button, type ButtonProps } from '@/components/ui/button';
import { THEME_PREFERENCE_KEY } from '@/components/ThemeProvider';

interface ThemeWipe {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  theme: 'light' | 'dark';
}

function getEventCoordinates(event: MouseEvent<HTMLButtonElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const native = event.nativeEvent as unknown as (TouchEvent & MouseEvent);
  
  let x = 0;
  let y = 0;

  if (native && native.touches && native.touches.length > 0) {
    x = native.touches[0].clientX;
    y = native.touches[0].clientY;
  } else if (native && native.changedTouches && native.changedTouches.length > 0) {
    x = native.changedTouches[0].clientX;
    y = native.changedTouches[0].clientY;
  } else {
    x = event.clientX;
    y = event.clientY;
  }

  // Fallback jika koordinat 0 / tidak terdeteksi (misal keyboard event)
  if (!x && !y) {
    x = bounds.left + bounds.width / 2;
    y = bounds.top + bounds.height / 2;
  }

  return { x, y };
}

export default function ThemeToggle({
  className,
  showLabel = true,
  size = 'default',
}: {
  className?: string;
  showLabel?: boolean;
  size?: ButtonProps['size'];
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [wipe, setWipe] = useState<ThemeWipe | null>(null);
  // Selama wipe berjalan, arah toggle mengikuti tema tujuan, bukan tema lama.
  const activeTheme = wipe ? wipe.theme : resolvedTheme;
  const isDark = ready && activeTheme === 'dark';
  const nextTheme: 'light' | 'dark' = isDark ? 'light' : 'dark';

  useEffect(() => {
    setReady(true);
  }, []);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const target = nextTheme;
    window.localStorage.setItem(THEME_PREFERENCE_KEY, target);

    if (wipe) {
      // Ditekan saat wipe masih jalan: langsung terapkan tanpa animasi.
      setWipe(null);
      root.classList.toggle('dark', target === 'dark');
      setTheme(target);
      return;
    }

    root.classList.toggle('dark', target === 'dark');
    const color = getComputedStyle(document.body).backgroundColor;
    root.classList.toggle('dark', activeTheme === 'dark');

    const { x, y } = getEventCoordinates(event);
    // Pakai viewport layout (bukan visual viewport) supaya radius tetap menutup
    // saat URL bar mobile muncul/hilang selama animasi.
    const doc = document.documentElement;
    const vw = Math.max(window.innerWidth, doc.clientWidth, doc.scrollWidth);
    const vh = Math.max(window.innerHeight, doc.clientHeight, doc.scrollHeight);
    
    // Fallback kalau titik klik 0,0 atau di luar layar (misal di-trigger lewat keyboard / screen reader)
    const finalX = x || vw / 2;
    const finalY = y || vh / 2;

    setWipe({
      id: Date.now(),
      x: finalX,
      y: finalY,
      radius: Math.hypot(Math.max(finalX, vw - finalX), Math.max(finalY, vh - finalY)) * 1.05,
      color,
      theme: target,
    });
  };

  return (
    <MotionConfig reducedMotion="never">
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={handleToggle}
        aria-label={`Gunakan mode ${nextTheme === 'dark' ? 'gelap' : 'terang'}`}
        aria-pressed={isDark}
        title={`Gunakan mode ${nextTheme === 'dark' ? 'gelap' : 'terang'}`}
        disabled={!ready}
        className={className}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="relative grid h-4 w-4 place-items-center">
            <motion.svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute inset-0 h-4 w-4 overflow-visible"
              initial={false}
            >
              <motion.g
                initial={false}
                animate={{
                  opacity: isDark ? 1 : 0,
                  rotate: isDark ? 0 : -70,
                  scale: isDark ? 1 : 0.55,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 0.7 }}
                style={{ transformOrigin: '12px 12px' }}
              >
                <circle cx="12" cy="12" r="3.8" />
                <path d="M12 1.75v2M12 20.25v2M4.76 4.76l1.42 1.42m11.64 11.64 1.42 1.42M1.75 12h2m16.5 0h2M4.76 19.24l1.42-1.42M17.82 6.18l1.42-1.42" />
              </motion.g>
              <motion.path
                d="M20.3 15.1A8.5 8.5 0 0 1 8.9 3.7 8.5 8.5 0 1 0 20.3 15.1Z"
                initial={false}
                animate={{
                  opacity: isDark ? 0 : 1,
                  rotate: isDark ? 70 : 0,
                  scale: isDark ? 0.55 : 1,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 0.7 }}
                style={{ transformOrigin: '12px 12px' }}
              />
            </motion.svg>
          </span>
          {showLabel && <span>{nextTheme === 'dark' ? 'Mode gelap' : 'Mode terang'}</span>}
        </span>
      </Button>

      {/* Portal ke body: di mobile, toggle ada di dalam sheet yang punya transform,
          sehingga `fixed` tanpa portal akan ter-contain oleh sheet, bukan viewport. */}
      {wipe && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
        >
          <motion.div
            key={wipe.id}
            className="absolute rounded-full will-change-transform"
            style={{
              backgroundColor: wipe.color,
              left: wipe.x - 12,
              top: wipe.y - 12,
              width: 24,
              height: 24,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: (wipe.radius * 2) / 24 }}
            transition={{ duration: 0.9, ease: [0.5, 0.05, 0.8, 0.25] }}
            onAnimationComplete={() => {
              // Lingkaran sudah menutup seluruh layar: ganti tema di balik overlay
              // dan hilangkan overlay pada frame yang sama supaya tidak ada flash.
              document.documentElement.classList.toggle('dark', wipe.theme === 'dark');
              setTheme(wipe.theme);
              setWipe(null);
            }}
          />
        </div>,
        document.body
      )}
    </MotionConfig>
  );
}

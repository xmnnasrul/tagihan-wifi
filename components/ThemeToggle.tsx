'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
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
  const prefersReducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [wipe, setWipe] = useState<ThemeWipe | null>(null);
  const isDark = ready && resolvedTheme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  useEffect(() => {
    setReady(true);
  }, []);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.toggle('dark', nextTheme === 'dark');
    const targetColor = getComputedStyle(document.body).backgroundColor;
    root.classList.toggle('dark', wasDark);
    window.localStorage.setItem(THEME_PREFERENCE_KEY, nextTheme);

    if (prefersReducedMotion) {
      setTheme(nextTheme);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    setWipe({
      id: Date.now(),
      x,
      y,
      radius: Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)),
      color: targetColor,
      theme: nextTheme,
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size}
        onClick={handleToggle}
        aria-label={`Gunakan mode ${nextTheme === 'dark' ? 'gelap' : 'terang'}`}
        aria-pressed={isDark}
        title={`Gunakan mode ${nextTheme === 'dark' ? 'gelap' : 'terang'}`}
        disabled={!ready || Boolean(wipe)}
        className={className}
      >
        <span className="flex items-center gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? 'sun' : 'moon'}
              initial={prefersReducedMotion ? false : { opacity: 0, rotate: -35, scale: 0.85 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, rotate: 35, scale: 0.85 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
          {showLabel && <span>{nextTheme === 'dark' ? 'Mode gelap' : 'Mode terang'}</span>}
        </span>
      </Button>

      <AnimatePresence initial={false}>
        {wipe && (
          <motion.div
            key={wipe.id}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[100]"
            style={{ backgroundColor: wipe.color }}
            initial={{ clipPath: `circle(0px at ${wipe.x}px ${wipe.y}px)` }}
            animate={{ clipPath: `circle(${wipe.radius * 1.08}px at ${wipe.x}px ${wipe.y}px)` }}
            transition={{ duration: 2.5, ease: [0.2, 0.82, 0.25, 1] }}
            onAnimationComplete={() => {
              setTheme(wipe.theme);
              requestAnimationFrame(() => setWipe((current) => current?.id === wipe.id ? null : current));
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {wipe && (
          <>
            {[0, 0.2].map((delay, index) => (
              <motion.span
                key={`ripple-${wipe.id}-${index}`}
                aria-hidden="true"
                className="pointer-events-none fixed z-[101] rounded-full border"
                style={{
                  left: wipe.x,
                  top: wipe.y,
                  width: wipe.radius * 2,
                  height: wipe.radius * 2,
                  marginLeft: -wipe.radius,
                  marginTop: -wipe.radius,
                  borderColor: wipe.theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.16)',
                }}
                initial={{ scale: 0.02, opacity: 0 }}
                animate={{ scale: 1.08, opacity: [0, index === 0 ? 0.3 : 0.18, 0] }}
                transition={{
                  duration: 2.5,
                  delay,
                  ease: [0.2, 0.82, 0.25, 1],
                  times: [0, 0.22, 1],
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </>
  );
}

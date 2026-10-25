'use client';

import { useEffect, useRef, useState } from 'react';
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
  const transitionTimer = useRef<number | null>(null);
  const isDark = ready && resolvedTheme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.remove('theme-transition');
  }, []);

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const surface = document.querySelector('.app-page') || document.body;
    const wasDark = root.classList.contains('dark');
    root.classList.toggle('dark', nextTheme === 'dark');
    const targetColor = getComputedStyle(surface).backgroundColor;
    root.classList.toggle('dark', wasDark);
    window.localStorage.setItem(THEME_PREFERENCE_KEY, nextTheme);

    if (prefersReducedMotion) {
      root.classList.add('theme-transition');
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => {
        root.classList.remove('theme-transition');
        transitionTimer.current = null;
      }, 160);
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
        disabled={!ready}
        aria-label={`Gunakan mode ${nextTheme === 'dark' ? 'gelap' : 'terang'}`}
        aria-pressed={isDark}
        title={`Gunakan mode ${nextTheme === 'dark' ? 'gelap' : 'terang'}`}
        className={className}
      >
        <span className="flex items-center gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? 'sun' : 'moon'}
              initial={prefersReducedMotion ? false : { opacity: 0, rotate: -35, scale: 0.85 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, rotate: 35, scale: 0.85 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
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
            animate={{ clipPath: `circle(${wipe.radius}px at ${wipe.x}px ${wipe.y}px)` }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => {
              setTheme(wipe.theme);
              requestAnimationFrame(() => setWipe((current) => current?.id === wipe.id ? null : current));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

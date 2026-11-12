'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
  const iconIsDark = wipe ? wipe.theme === 'dark' : isDark;

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
          <span aria-hidden="true" className="relative grid h-4 w-4 place-items-center">
            <motion.svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`absolute inset-0 h-4 w-4 overflow-visible ${!wipe ? (iconIsDark ? 'theme-sun-idle' : 'theme-moon-idle') : ''}`}
              initial={false}
            >
              <motion.g
                initial={false}
                animate={{
                  opacity: iconIsDark ? 1 : 0,
                  rotate: iconIsDark ? 0 : -70,
                  scale: iconIsDark ? 1 : 0.55,
                }}
                transition={prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 260, damping: 19, mass: 0.72 }}
                style={{ transformOrigin: '12px 12px' }}
              >
                <circle cx="12" cy="12" r="3.8" />
                <path d="M12 1.75v2M12 20.25v2M4.76 4.76l1.42 1.42m11.64 11.64 1.42 1.42M1.75 12h2m16.5 0h2M4.76 19.24l1.42-1.42M17.82 6.18l1.42-1.42" />
              </motion.g>
              <motion.path
                d="M20.3 15.1A8.5 8.5 0 0 1 8.9 3.7 8.5 8.5 0 1 0 20.3 15.1Z"
                initial={false}
                animate={{
                  opacity: iconIsDark ? 0 : 1,
                  rotate: iconIsDark ? 70 : 0,
                  scale: iconIsDark ? 0.55 : 1,
                }}
                transition={prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 260, damping: 19, mass: 0.72 }}
                style={{ transformOrigin: '12px 12px' }}
              />
            </motion.svg>
          </span>
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
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => {
              document.documentElement.classList.add('theme-transition');
              setTheme(wipe.theme);
              window.setTimeout(() => {
                document.documentElement.classList.remove('theme-transition');
              }, 760);
              requestAnimationFrame(() => setWipe((current) => current?.id === wipe.id ? null : current));
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {wipe && (
          <>
            {[0, 0.14].map((delay, index) => (
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
                  borderColor: wipe.theme === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.14)',
                }}
                initial={{ scale: 0.01, opacity: 0 }}
                animate={{ scale: 1.08, opacity: [0, index === 0 ? 0.24 : 0.16, 0] }}
                transition={{
                  duration: 0.95,
                  delay,
                  ease: [0.16, 1, 0.3, 1],
                  times: [0, 0.18, 1],
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useTheme } from 'next-themes';

export const THEME_PREFERENCE_KEY = 'wifi-billing-theme-preference';

export function getScheduledTheme(): 'light' | 'dark' {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date()).find((part) => part.type === 'hour')?.value);

  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

function ThemeSchedule() {
  const { resolvedTheme, setTheme } = useTheme();
  const transitionTimer = useRef<number | null>(null);

  useEffect(() => {
    const syncTheme = () => {
      const manualPreference = window.localStorage.getItem(THEME_PREFERENCE_KEY);
      const hasManualPreference = manualPreference === 'light' || manualPreference === 'dark';
      const targetTheme = hasManualPreference ? manualPreference : getScheduledTheme();
      if (targetTheme !== resolvedTheme) {
        document.documentElement.classList.add('theme-transition');
        setTheme(targetTheme);
        if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
        transitionTimer.current = window.setTimeout(() => {
          document.documentElement.classList.remove('theme-transition');
          transitionTimer.current = null;
        }, 280);
      }
      if (!hasManualPreference) window.localStorage.removeItem(THEME_PREFERENCE_KEY);
    };

    syncTheme();
    const interval = window.setInterval(syncTheme, 60_000);
    return () => window.clearInterval(interval);
  }, [resolvedTheme, setTheme]);

  useEffect(() => () => {
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.remove('theme-transition');
  }, []);

  return null;
}

export default function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // Browsers hide nonce attributes from hydration reads, so match the masked client-side value.
  const providerNonce = typeof window === 'undefined' ? nonce : '';

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={getScheduledTheme()}
      enableSystem={false}
      nonce={providerNonce}
      storageKey={THEME_PREFERENCE_KEY}
    >
      <MotionConfig reducedMotion="user">
        <ThemeSchedule />
        {children}
      </MotionConfig>
    </NextThemesProvider>
  );
}
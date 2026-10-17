'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    const syncTheme = () => {
      const manualPreference = window.localStorage.getItem(THEME_PREFERENCE_KEY);
      const hasManualPreference = manualPreference === 'light' || manualPreference === 'dark';
      const targetTheme = hasManualPreference ? manualPreference : getScheduledTheme();
      if (targetTheme !== resolvedTheme) setTheme(targetTheme);
      if (!hasManualPreference) window.localStorage.removeItem(THEME_PREFERENCE_KEY);
    };

    syncTheme();
    const interval = window.setInterval(syncTheme, 60_000);
    return () => window.clearInterval(interval);
  }, [resolvedTheme, setTheme]);

  return null;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={getScheduledTheme()}
      enableSystem={false}
      storageKey={THEME_PREFERENCE_KEY}
    >
      <ThemeSchedule />
      {children}
    </NextThemesProvider>
  );
}
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { Toaster } from '@/components/ui/sonner';
import ThemeProvider from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tagihan WiFi',
  description: 'Manajemen Tagihan WiFi - Kelola pelanggan dan tagihan bulanan',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') || undefined;

  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} bg-background text-foreground antialiased`}>
        <ThemeProvider nonce={nonce}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}

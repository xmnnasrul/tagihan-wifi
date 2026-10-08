import Link from 'next/link';
import { ArrowLeft, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-16 text-center">
      <div className="animate-fade-in">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-primary">ERROR 404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Halaman tidak ditemukan</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Alamat yang kamu buka mungkin salah atau halaman tersebut sudah dipindahkan.
        </p>
        <Button asChild className="mt-7">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Kembali ke Dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
}
import { requireSuperadmin } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function AdminsLayout({ children }: { children: React.ReactNode }) {
  const authError = await requireSuperadmin();
  if (authError) {
    if (authError.status === 401) redirect('/login');
    if (authError.status === 403) redirect('/dashboard');
    throw new Error('Gagal memverifikasi akses akun');
  }

  return <>{children}</>;
}
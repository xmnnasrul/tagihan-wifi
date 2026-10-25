import AppLayoutFrame from '@/components/AppLayoutFrame';
import CurrentUserProvider from '@/components/CurrentUserProvider';
import { requireAdmin } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const authError = await requireAdmin();
  if (authError) {
    if (authError.status === 401) redirect('/login');
    if (authError.status === 403) redirect('/login');
    throw new Error('Gagal memverifikasi akses akun');
  }

  return (
    <CurrentUserProvider>
      <AppLayoutFrame>{children}</AppLayoutFrame>
    </CurrentUserProvider>
  );
}

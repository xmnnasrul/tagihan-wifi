import AppLayoutFrame from '@/components/AppLayoutFrame';
import CurrentUserProvider from '@/components/CurrentUserProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <AppLayoutFrame>{children}</AppLayoutFrame>
    </CurrentUserProvider>
  );
}

import NavSidebar from '@/components/NavSidebar';
import CurrentUserProvider from '@/components/CurrentUserProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <div className="min-h-screen bg-background">
        <NavSidebar />
        <main className="min-w-0 overflow-x-hidden pt-14 lg:pl-72 lg:pt-0">
          <div className="mx-auto min-h-screen w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </CurrentUserProvider>
  );
}

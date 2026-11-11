import NavSidebar from '@/components/NavSidebar';
import PageTransition from '@/components/PageTransition';

export default function AppLayoutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NavSidebar />
      <main className="min-w-0 overflow-x-clip bg-[hsl(var(--chrome))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-14 md:min-h-screen md:pb-2 md:pt-20">
        <div className="app-page mx-auto min-h-[calc(100dvh-3.5rem)] w-full min-w-0 max-w-[1800px] bg-background px-3 py-5 sm:px-5 sm:py-6 md:min-h-[calc(100dvh-5rem)] md:rounded-xl md:border md:border-border md:bg-card md:px-6 md:py-6">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}

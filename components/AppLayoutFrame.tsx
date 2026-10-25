import NavSidebar from '@/components/NavSidebar';
import PageTransition from '@/components/PageTransition';

export default function AppLayoutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NavSidebar />
      <main className="min-w-0 overflow-x-hidden bg-[hsl(var(--chrome))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-14 lg:min-h-screen lg:pb-2 lg:pl-64 lg:pr-2 lg:pt-14">
        <div className="app-page mx-auto min-h-[calc(100dvh-3.5rem)] w-full min-w-0 max-w-[1800px] bg-background px-3 py-5 sm:px-5 sm:py-6 lg:min-h-[calc(100dvh-4rem)] lg:rounded-xl lg:border lg:border-border lg:bg-card lg:px-6 lg:py-6">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}

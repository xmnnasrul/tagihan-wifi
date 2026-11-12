import NavSidebar from '@/components/NavSidebar';
import PageTransition from '@/components/PageTransition';

export default function AppLayoutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NavSidebar />
      <main className="min-w-0 overflow-x-clip bg-[hsl(var(--chrome))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-14 min-[60rem]:min-h-screen min-[60rem]:pb-2 min-[60rem]:pt-20">
        <div className="app-page mx-auto min-h-[calc(100dvh-3.5rem)] w-full min-w-0 max-w-[1800px] bg-background px-3 py-5 sm:px-5 sm:py-6 min-[60rem]:min-h-[calc(100dvh-5rem)] min-[60rem]:rounded-xl min-[60rem]:border min-[60rem]:border-border min-[60rem]:bg-card min-[60rem]:px-6 min-[60rem]:py-6">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}

import NavSidebar from '@/components/NavSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <NavSidebar />
      <main className="min-w-0 overflow-x-hidden lg:pl-64 pt-14 lg:pt-0">
        <div className="w-full min-w-0 px-4 py-6 lg:px-8 lg:py-8 max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

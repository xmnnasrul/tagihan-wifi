'use client';

import { usePathname } from 'next/navigation';
import NavSidebar from '@/components/NavSidebar';

export default function AppLayoutFrame({ children }: { children: React.ReactNode }) {
  const isChatPage = usePathname() === '/chat';

  return (
    <div className={`${isChatPage ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-background`}>
      <NavSidebar />
      <main className={`min-w-0 overflow-x-hidden pt-14 lg:pl-72 lg:pt-0 ${isChatPage ? 'h-full overflow-y-hidden' : ''}`}>
        <div className={`mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 animate-fade-in ${isChatPage ? 'h-full min-h-0 overflow-hidden' : 'min-h-screen'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}

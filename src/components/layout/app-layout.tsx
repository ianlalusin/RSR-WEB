'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { Header } from './header';
import { useIsMobile } from '@/hooks/use-mobile';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {isMobile ? <BottomNav /> : <Sidebar />}
      <div className={`flex flex-col w-full ${isMobile ? 'pb-16' : 'sm:pl-48'}`}>
        <Header />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

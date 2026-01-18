'use client';

import { Toaster } from '@/components/ui/toaster';
import dynamic from 'next/dynamic';
import { Landmark } from 'lucide-react';

const FullScreenLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <Landmark className="h-16 w-16 animate-pulse text-primary" />
      <p className="text-muted-foreground">Loading RSR Web...</p>
    </div>
  </div>
);

const AuthProvider = dynamic(
  () => import('@/components/providers/auth-provider').then((mod) => mod.AuthProvider),
  { 
    ssr: false,
    loading: () => <FullScreenLoader />
  }
);


export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>
        {children}
      </AuthProvider>
      <Toaster />
    </>
  );
}

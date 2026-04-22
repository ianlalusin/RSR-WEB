'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import AppLayout from '@/components/layout/app-layout';
import { Landmark } from 'lucide-react';

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl font-extrabold tracking-tight text-primary animate-pulse">TAPp</span>
        <p className="text-xs text-muted-foreground">Talino at Puso App</p>
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!userProfile?.isActive) {
      router.replace('/pending');
      return;
    }
  }, [loading, user, userProfile, router, pathname]);

  if (loading || !user || !userProfile) {
    return <FullScreenLoader />;
  }

  if (!userProfile.isActive) {
      // This case should be handled by the redirect, but as a fallback:
      return <FullScreenLoader />;
  }

  return <AppLayout>{children}</AppLayout>;
}

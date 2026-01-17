'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserProfile } from '@/hooks/useUserProfile';
import AppLayout from '@/components/layout/app-layout';
import { Landmark } from 'lucide-react';

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Landmark className="h-16 w-16 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading RSR Web...</p>
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, loading: authLoading } = useAuthUser();
  const { profile, loading: profileLoading } = useUserProfile(user?.uid);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!profile?.isActive) {
      router.replace('/login?reason=inactive');
      return;
    }
  }, [authLoading, profileLoading, user, profile, router, pathname]);

  if (authLoading || profileLoading || !user || !profile) {
    return <FullScreenLoader />;
  }

  if (!profile.isActive) {
      // This case should be handled by the redirect, but as a fallback:
      return <FullScreenLoader />;
  }

  return <AppLayout>{children}</AppLayout>;
}

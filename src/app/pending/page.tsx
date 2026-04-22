'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';

export default function PendingPage() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (userProfile?.isActive) { router.replace('/'); return; }
  }, [loading, user, userProfile, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (loading || !user) return null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100">
            <Clock className="h-7 w-7 text-yellow-600" />
          </div>
          <CardTitle>Account Pending Approval</CardTitle>
          <CardDescription className="mt-2">
            Your account has been created and is waiting for an administrator to activate it.
            You will gain access once approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </div>
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

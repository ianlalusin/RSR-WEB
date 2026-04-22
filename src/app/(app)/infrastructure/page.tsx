'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';

export default function InfrastructurePage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();

  if (!canViewPage(userProfile, 'projects_infrastructure', { isPlatformAdminClaim })) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
        <p className="text-muted-foreground">Infrastructure projects and initiatives.</p>
      </div>
      <Card>
        <CardHeader className="items-center text-center py-12">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>Infrastructure project management is under development.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

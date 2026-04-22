'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users, ChevronRight } from 'lucide-react';

function AccessDenied() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Denied</CardTitle>
      </CardHeader>
    </Card>
  );
}

const adminCards = [
  {
    title: 'User Management',
    description: 'Manage user roles, permissions, districts, and active status.',
    href: '/admin/users',
    icon: Users,
  },
];

export default function AdminPage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();

  const canAccess = canViewPage(userProfile, 'admin_users', { isPlatformAdminClaim });

  if (!canAccess) return <AccessDenied />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">Manage platform settings and users.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <card.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

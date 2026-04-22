'use client';

import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartHandshake, Building2, Wallet, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';

const medicalCards = [
  {
    title: 'Medical Assistance',
    description: 'Manage medical drives, individual assistance, and referrals.',
    href: '/medical/assistance',
    icon: HeartHandshake,
  },
  {
    title: 'Accredited Hospitals',
    description: 'Manage the list of partner hospitals for medical programs.',
    href: '/medical/hospitals',
    icon: Building2,
  },
  {
    title: 'Financial Standing',
    description: 'Track financial status and budget for medical programs.',
    href: '/medical/financial',
    icon: Wallet,
  },
];

export default function MedicalHubPage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();

  if (!canViewPage(userProfile, 'projects_medical', { isPlatformAdminClaim })) {
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
        <h1 className="text-2xl font-bold tracking-tight">Medical</h1>
        <p className="text-muted-foreground">Medical assistance programs, hospitals, and financial tracking.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {medicalCards.map((card) => (
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

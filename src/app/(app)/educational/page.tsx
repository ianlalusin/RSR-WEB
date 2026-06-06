'use client';

import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Award, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';

import type { PageKey } from '@/lib/types';

const educationalCards: { title: string; description: string; href: string; icon: any; pageKey: PageKey }[] = [
  {
    title: 'CHED Tulong Dunong',
    description: 'Review public Tulong Dunong applications, download Excel, and open the form.',
    href: '/educational/ched',
    icon: BookOpen,
    pageKey: 'scholarship_applications',
  },
  {
    title: 'Recto Tulong Dunong',
    description: 'Review applications submitted through the public Tulong Dunong registration form.',
    href: '/educational/scholarship',
    icon: Award,
    pageKey: 'scholarship_applications',
  },
];

export default function EducationalHubPage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();
  const authOpts = { isPlatformAdminClaim };

  const visibleCards = educationalCards.filter((c) => canViewPage(userProfile, c.pageKey, authOpts));

  if (visibleCards.length === 0) {
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
        <h1 className="text-2xl font-bold tracking-tight">Educational</h1>
        <p className="text-muted-foreground">Scholarship programs and educational initiatives.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleCards.map((card) => (
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

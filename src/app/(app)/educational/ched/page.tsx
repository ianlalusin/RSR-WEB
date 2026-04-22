'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function CHEDTulongDunongPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CHED Tulong Dunong</h1>
        <p className="text-muted-foreground">CHED Tulong Dunong scholarship program management.</p>
      </div>
      <Card>
        <CardHeader className="items-center text-center py-12">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>CHED Tulong Dunong management is under development.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

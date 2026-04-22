'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function CongScholarshipPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Congressional Scholarship</h1>
        <p className="text-muted-foreground">Congressional scholarship program management.</p>
      </div>
      <Card>
        <CardHeader className="items-center text-center py-12">
          <Construction className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>Congressional scholarship management is under development.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

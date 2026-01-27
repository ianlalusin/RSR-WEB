'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, GraduationCap, HeartPulse, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';


const projectTypes = [
    {
        title: 'Medical Projects',
        description: 'Manage medical missions, distribution of medicines, and health services.',
        href: '/projects/medical',
        icon: HeartPulse
    },
    {
        title: 'Educational Projects',
        description: 'Oversee scholarship programs, school supply distribution, and educational workshops.',
        href: '/projects/educational',
        icon: GraduationCap
    },
    {
        title: 'Infrastructure Projects',
        description: 'Track and manage local infrastructure projects like road repairs and building constructions.',
        href: '/projects/infrastructure',
        icon: Building
    }
]

function AccessDenied() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view this page.</p>
        </CardContent>
      </Card>
    );
}

export default function RSRProjectsPage() {
  const { userProfile } = useAuth();
  
  if (!canViewPage(userProfile, 'projects')) {
    return <AccessDenied />;
  }
  
  return (
    <div className="grid gap-6">
        <Card>
            <CardHeader>
                <CardTitle>RSR Projects and Initiatives</CardTitle>
                <CardDescription>
                    Centrally manage all projects and initiatives across different sectors. 
                    Create projects here and tag the beneficiary barangays.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
                    {projectTypes.map((type) => (
                        <Card key={type.href}>
                            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                                <div className="p-3 bg-primary/10 rounded-md">
                                    <type.icon className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>{type.title}</CardTitle>
                                    <CardDescription className="mt-1">{type.description}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Button asChild className="w-full">
                                    <Link href={type.href}>Manage {type.title.split(' ')[0]}</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

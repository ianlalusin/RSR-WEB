'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Barangay } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, hasDistrictScope } from '@/lib/access';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Vote, HandCoins, Edit, User, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import BrgyFormDialog from '../_components/brgy-form-dialog';
import CaptainProfileDialog from './_components/captain-profile-dialog';
import GenerateProfilesDialog from './_components/generate-profiles-dialog';

function DetailPageSkeleton() {
    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <Skeleton className="h-9 w-64 mb-3" />
                            <Skeleton className="h-5 w-48" />
                        </div>
                        <div className="flex gap-2">
                           <Skeleton className="h-10 w-24" />
                           <Skeleton className="h-10 w-24" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
            <Skeleton className="h-96 w-full" />
        </div>
    )
}

function AccessDenied() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view this page or this specific barangay.</p>
        </CardContent>
      </Card>
    );
}

export default function BarangayDetailPage() {
  const params = useParams();
  const brgyId = params.brgyId as string;
  const [barangay, setBarangay] = useState<Barangay | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile, isPlatformAdminClaim } = useAuth();
  const authOpts = { isPlatformAdminClaim };

  const canView = canViewPage(userProfile, 'barangay_detail', authOpts);

  useEffect(() => {
    if (!brgyId || !canView) {
        setLoading(false);
        return;
    };
    
    const unsub = onSnapshot(doc(db, 'barangays', brgyId), (doc) => {
      if (doc.exists()) {
        const brgyData = { id: doc.id, ...doc.data() } as Barangay;
        // Scope check
        if (hasDistrictScope(userProfile, brgyData.districtId, authOpts)) {
            setBarangay(brgyData);
        } else {
            setBarangay(null); // Explicitly set to null if out of scope
        }
      } else {
        notFound();
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching barangay:", error);
      setLoading(false);
      notFound();
    });

    return () => unsub();
  }, [brgyId, userProfile, canView, authOpts]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!canView || !barangay) {
    return <AccessDenied />;
  }
  
  const canWrite = canDo(userProfile, 'barangay_detail', 'update', authOpts);

  return (
    <div className="grid gap-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-bold">{barangay.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-2">
                            <span>{barangay.districtName}</span>
                            <Badge variant={barangay.isWin ? 'default' : 'secondary'} className={barangay.isWin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {barangay.isWin ? 'Win' : 'Lose'}
                            </Badge>
                        </CardDescription>
                    </div>
                    <div className='flex gap-2'>
                        {canWrite && (
                            <BrgyFormDialog barangay={barangay}>
                                <Button variant="outline"><Edit className="mr-2"/>Edit Barangay</Button>
                            </BrgyFormDialog>
                        )}
                        <CaptainProfileDialog brgyId={barangay.id} canEdit={canWrite}>
                            <Button variant="outline"><User className="mr-2"/>Captain Profile</Button>
                        </CaptainProfileDialog>
                         <GenerateProfilesDialog barangay={barangay} canGenerate={canWrite} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.population.toLocaleString()}</p>
                            <p className="text-muted-foreground">Population</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Vote className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.votingPopulation.toLocaleString()}</p>
                            <p className="text-muted-foreground">Voting Population</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.rsrVotes.toLocaleString()}</p>
                            <p className="text-muted-foreground">RSR Votes</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <HandCoins className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.favoredVotePct.toFixed(1)}%</p>
                            <p className="text-muted-foreground">Favored Vote</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* The assistance records will now be shown here, queried from the global assistance collections */}
        <Card>
            <CardHeader>
                <CardTitle>RSR Projects & Initiatives</CardTitle>
                <CardDescription>Projects and initiatives this barangay is a beneficiary of.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Coming soon: A list of all projects and initiatives this barangay is a beneficiary of.</p>
            </CardContent>
        </Card>
    </div>
  );
}

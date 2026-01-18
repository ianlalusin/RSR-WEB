'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Barangay } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canWriteBarangay, canWriteCaptain } from '@/lib/permissions';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Vote, HandCoins, Edit, User } from 'lucide-react';
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


export default function BarangayDetailPage() {
  const params = useParams();
  const brgyId = params.brgyId as string;
  const [barangay, setBarangay] = useState<Barangay | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  
  useEffect(() => {
    if (!brgyId) return;
    
    const unsub = onSnapshot(doc(db, 'barangays', brgyId), (doc) => {
      if (doc.exists()) {
        setBarangay({ id: doc.id, ...doc.data() } as Barangay);
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
  }, [brgyId]);

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!barangay) {
    // This case is handled by notFound(), but it's good for type safety
    return null;
  }
  
  const canEditBrgy = canWriteBarangay(userProfile);
  const canEditCaptain = canWriteCaptain(userProfile);

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
                        {canEditBrgy && (
                            <BrgyFormDialog barangay={barangay}>
                                <Button variant="outline"><Edit className="mr-2"/>Edit Barangay</Button>
                            </BrgyFormDialog>
                        )}
                        <CaptainProfileDialog brgyId={barangay.id} canEdit={canEditCaptain}>
                            <Button variant="outline"><User className="mr-2"/>Captain Profile</Button>
                        </CaptainProfileDialog>
                         <GenerateProfilesDialog barangay={barangay} />
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

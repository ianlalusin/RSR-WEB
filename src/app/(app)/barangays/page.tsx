'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Barangay, BarangayListDoc } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, isPlatformAdmin } from '@/lib/access';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import BrgyFormDialog from './_components/brgy-form-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import UploadBrgyDialog from './_components/upload-brgy-dialog';

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

export default function BarangaysPage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);

  const authOpts = { isPlatformAdminClaim };
  const canView = canViewPage(userProfile, 'barangays_list', authOpts);
  const canWrite = canDo(userProfile, 'barangays_list', 'create', authOpts);
  const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim);

  useEffect(() => {
    if (!canView || !userProfile) {
      setLoading(false);
      return;
    }

    const listDocRef = doc(db, 'lists', 'barangays');

    const unsub = onSnapshot(listDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const listData = docSnap.data() as BarangayListDoc;
        let allBarangays = Object.entries(listData.barangays || {}).map(([id, data]) => ({
          ...data,
          id,
        }));

        if (!isAdmin && userProfile.access.districtIds.length > 0) {
          allBarangays = allBarangays.filter(brgy => userProfile.access.districtIds.includes(brgy.districtId));
        } else if (!isAdmin && userProfile.access.districtIds.length === 0) {
          allBarangays = [];
        }

        setBarangays(allBarangays.sort((a, b) => a.name.localeCompare(b.name)) as Barangay[]);
        setLoading(false);
      } else {
        // One-time migration: List doc doesn't exist, create it from collection
        setLoading(true);
        console.log("Barangay list document not found. Generating from collection...");

        const brgyCollectionRef = collection(db, 'barangays');
        const brgyQuery = query(brgyCollectionRef);
        const brgySnapshot = await getDocs(brgyQuery);

        if (brgySnapshot.empty) {
            await setDoc(listDocRef, { barangays: {} });
            setBarangays([]);
            setLoading(false);
            return;
        }

        const listUpdates: Record<string, any> = {};
        brgySnapshot.forEach(brgyDoc => {
          const brgyData = brgyDoc.data() as Omit<Barangay, 'id'>;
          listUpdates[brgyDoc.id] = {
            name: brgyData.name,
            districtId: brgyData.districtId,
            districtName: brgyData.districtName,
            population: brgyData.population,
            votingPopulation: brgyData.votingPopulation,
            rsrVotes: brgyData.rsrVotes,
            favoredVotePct: brgyData.favoredVotePct,
            isWin: brgyData.isWin,
          };
        });

        await setDoc(listDocRef, { barangays: listUpdates });
        // The snapshot listener will be triggered again by setDoc, and then it will set state and loading.
      }
    }, (error) => {
        console.error("Error fetching barangay list:", error);
        setLoading(false)
    });

    return () => unsub();
  }, [canView, userProfile, isAdmin]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Barangays</CardTitle>
              <CardDescription>
                A list of all barangays in the system.
              </CardDescription>
            </div>
            <Skeleton className="h-10 w-36" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!canView) {
    return <AccessDenied />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Barangays</CardTitle>
            <CardDescription>
              A list of all barangays in the system, updated in real-time.
            </CardDescription>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <UploadBrgyDialog />
              <BrgyFormDialog>
                  <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Barangay
                  </Button>
              </BrgyFormDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={barangays} />
      </CardContent>
    </Card>
  );
}

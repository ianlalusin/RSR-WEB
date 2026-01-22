'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Barangay } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, isPlatformAdmin } from '@/lib/access';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import BrgyFormDialog from './_components/brgy-form-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import UploadBrgyDialog from './_components/upload-brgy-dialog';
import SyncDistrictsButton from './_components/sync-districts-button';

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
  const { userProfile } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);

  const canView = canViewPage(userProfile, 'barangays_list');
  const canWrite = canDo(userProfile, 'barangays_list', 'create');
  const canDeleteBrgy = canDo(userProfile, 'barangays_list', 'delete');

  useEffect(() => {
    if (!canView || !userProfile) {
      setLoading(false);
      return;
    }

    const queryConstraints: QueryConstraint[] = [orderBy('name', 'asc')];
    
    // If not a platform admin and has district scope, filter by district
    if (!isPlatformAdmin(userProfile) && userProfile.access.districtIds.length > 0) {
        queryConstraints.push(where('districtId', 'in', userProfile.access.districtIds));
    } else if (!isPlatformAdmin(userProfile) && userProfile.access.districtIds.length === 0) {
        // If not a platform admin and has no districts assigned, they see nothing.
        setBarangays([]);
        setLoading(false);
        return;
    }

    const q = query(
      collection(db, 'barangays'),
      ...queryConstraints
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: Barangay[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setBarangays(data);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [canView, userProfile]);

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
              {canDeleteBrgy && <SyncDistrictsButton />}
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

'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
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
import { canReadBarangays, canWriteBarangay, canDelete } from '@/lib/permissions';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import BrgyFormDialog from './_components/brgy-form-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import UploadBrgyDialog from './_components/upload-brgy-dialog';
import SyncDistrictsButton from './_components/sync-districts-button';

export default function BarangaysPage() {
  const { userProfile } = useAuth();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);

  const canRead = canReadBarangays(userProfile);
  const canWrite = canWriteBarangay(userProfile);
  const canDel = canDelete(userProfile);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'barangays'),
      orderBy('name', 'asc'),
      limit(200)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: Barangay[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setBarangays(data);
      setLoading(false);
    });

    return () => unsub();
  }, [canRead]);

  const handleUploadSuccess = () => {
    // onSnapshot will handle the update automatically
  };

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
            {canWrite && <Skeleton className="h-10 w-36" />}
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

  if (!canRead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">
            You do not have permission to view this page.
          </p>
        </CardContent>
      </Card>
    );
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
              {canDel && <SyncDistrictsButton />}
              <UploadBrgyDialog onSuccess={handleUploadSuccess} />
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

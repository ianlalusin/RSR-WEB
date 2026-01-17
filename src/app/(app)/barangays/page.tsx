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
import { useAuthUser } from '@/hooks/useAuthUser';
import { useUserProfile } from '@/hooks/useUserProfile';
import { can } from '@/lib/permissions';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';

export default function BarangaysPage() {
  const { user } = useAuthUser();
  const { profile } = useUserProfile(user?.uid);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(true);

  const canReadBarangays = can(profile, 'brgy.read');

  useEffect(() => {
    if (!canReadBarangays) {
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
  }, [canReadBarangays]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Barangays</CardTitle>
          <CardDescription>
            A list of all barangays in the system.
          </CardDescription>
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

  if (!canReadBarangays) {
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
        <CardTitle>Barangays</CardTitle>
        <CardDescription>
          A list of all barangays in the system, updated in real-time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={barangays} />
      </CardContent>
    </Card>
  );
}

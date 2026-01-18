'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AssistanceRecord, Barangay, AssistanceSector } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canWriteBarangay } from '@/lib/permissions';
import { DataTable } from './assistance-data-table';
import { getAssistanceColumns } from './assistance-columns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import AssistanceFormDialog from './assistance-form-dialog';


interface Props {
    barangay: Barangay;
    sector: AssistanceSector;
}

export default function AssistanceTabContent({ barangay, sector }: Props) {
  const { userProfile } = useAuth();
  const [records, setRecords] = useState<AssistanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const canWrite = canWriteBarangay(userProfile);

  useEffect(() => {
    const q = query(
      collection(db, 'assistanceRecords'),
      where('brgyId', '==', barangay.id),
      where('sector', '==', sector),
      orderBy('eventDate', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: AssistanceRecord[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssistanceRecord));
      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error(`Failed to fetch ${sector} records:`, error);
      setLoading(false);
    });

    return () => unsub();
  }, [barangay.id, sector]);

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48" />
                    {canWrite && <Skeleton className="h-10 w-28" />}
                </div>
                 <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-48 w-full" />
            </CardContent>
        </Card>
    );
  }

  const columns = getAssistanceColumns({ canWrite });
  const title = `${sector.charAt(0).toUpperCase() + sector.slice(1)} Assistance`;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Records of {sector} assistance provided to this barangay.
            </CardDescription>
          </div>
          {canWrite && (
             <AssistanceFormDialog barangay={barangay} sector={sector}>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Record
                </Button>
            </AssistanceFormDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={records} />
      </CardContent>
    </Card>
  );
}

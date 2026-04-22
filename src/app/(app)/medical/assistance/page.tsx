'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MedicalRecord } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, isPlatformAdmin } from '@/lib/access';
import { DataTable } from '../data-table';
import { columns } from '../columns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import MedicalFormDialog from '../_components/medical-form-dialog';

export default function MedicalAssistancePage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const authOpts = { isPlatformAdminClaim };
  const canView = canViewPage(userProfile, 'projects_medical', authOpts);
  const canWrite = canDo(userProfile, 'projects_medical', 'create', authOpts);
  const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim);

  useEffect(() => {
    if (!canView || !userProfile) {
      setLoading(false);
      return;
    }

    const recordsCollection = collection(db, 'medicalRecords');
    let recordsQuery = query(recordsCollection);

    if (!isAdmin && userProfile.access.districtIds.length > 0) {
      recordsQuery = query(recordsCollection, where('districtId', 'in', userProfile.access.districtIds));
    } else if (!isAdmin && userProfile.access.districtIds.length === 0) {
      setMedicalRecords([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(recordsQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MedicalRecord));
      setMedicalRecords(records);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching medical records: ", error);
      setLoading(false);
    });

    return () => unsub();
  }, [canView, userProfile, isAdmin]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Medical Assistance</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Medical Assistance</CardTitle>
            <CardDescription>Manage all medical drives and individual assistance records.</CardDescription>
          </div>
          {canWrite && (
            <MedicalFormDialog>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </MedicalFormDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={medicalRecords} />
      </CardContent>
    </Card>
  );
}

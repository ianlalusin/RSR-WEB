'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MedicalRecord } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, getScopeFilter } from '@/lib/access';
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

  useEffect(() => {
    if (!canView || !userProfile) {
      setLoading(false);
      return;
    }

    const recordsCollection = collection(db, 'medicalRecords');
    let recordsQuery = query(recordsCollection);

    // Scope the query to what firestore.rules will allow for this role tier.
    const filter = getScopeFilter(userProfile, { isPlatformAdminClaim });
    if (filter.mode === 'none') {
      setMedicalRecords([]);
      setLoading(false);
      return;
    }
    if (filter.mode === 'byDistrict') {
      if (filter.districtIds.length === 0) { setMedicalRecords([]); setLoading(false); return; }
      recordsQuery = query(recordsCollection, where('districtId', 'in', filter.districtIds.slice(0, 30)));
    } else if (filter.mode === 'byBarangay') {
      if (filter.barangayIds.length === 0) { setMedicalRecords([]); setLoading(false); return; }
      recordsQuery = query(recordsCollection, where('brgyId', 'in', filter.barangayIds.slice(0, 30)));
    }
    // mode 'all' → no location filter

    const unsub = onSnapshot(recordsQuery, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MedicalRecord));
      setMedicalRecords(records);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching medical records: ", error);
      setLoading(false);
    });

    return () => unsub();
  }, [canView, userProfile, isPlatformAdminClaim]);

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

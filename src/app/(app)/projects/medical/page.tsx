'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MedicalRecord } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, isPlatformAdmin } from '@/lib/access';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload, AlertTriangle } from 'lucide-react';
import MedicalFormDialog from './_components/medical-form-dialog';

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

export default function MedicalProjectsPage() {
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

    // If user is not admin and has district scope, filter by their districts
    if (!isAdmin && userProfile.access.districtIds.length > 0) {
      recordsQuery = query(recordsCollection, where('districtId', 'in', userProfile.access.districtIds));
    } else if (!isAdmin && userProfile.access.districtIds.length === 0) {
      // If not an admin and no districts assigned, they can't see any records.
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
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Medical Projects</CardTitle>
              <CardDescription>
                A list of all medical-related projects and assistance.
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
            <CardTitle>Medical Projects</CardTitle>
            <CardDescription>
              Manage all medical drives and individual assistance records.
            </CardDescription>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Data
              </Button>
              <MedicalFormDialog>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Medical Record
                </Button>
              </MedicalFormDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={medicalRecords} />
      </CardContent>
    </Card>
  );
}

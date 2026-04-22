
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hospital, HospitalListDoc } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo } from '@/lib/access';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import { DataTable } from '@/app/(app)/organization/data-table';
import { getHospitalColumns } from './columns';
import HospitalFormDialog from './_components/hospital-form-dialog';


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

export default function HospitalsPage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  const authOpts = { isPlatformAdminClaim };
  const canView = canViewPage(userProfile, 'projects_hospitals', authOpts);
  const canWrite = canDo(userProfile, 'projects_hospitals', 'create', authOpts);
  const canUpdate = canDo(userProfile, 'projects_hospitals', 'update', authOpts);
  const canDelete = canDo(userProfile, 'projects_hospitals', 'delete', authOpts);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    const listDocRef = doc(db, 'lists', 'hospitals');
    const unsub = onSnapshot(listDocRef, async (snap) => {
        if (snap.exists()) {
            const listData = snap.data() as HospitalListDoc;
            const hospitalList = Object.entries(listData.hospitals || {}).map(([id, data]) => ({ id, ...data } as Hospital));
            setHospitals(hospitalList.sort((a,b) => a.name.localeCompare(b.name)));
        } else {
            console.log("Hospitals list document not found. Creating it...");
            await setDoc(listDocRef, { hospitals: {} });
            setHospitals([]);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching hospitals list:", error);
        setLoading(false)
    });

    return () => unsub();
  }, [canView]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
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
  
  const columns = getHospitalColumns({ canUpdate, canDelete });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Accredited Hospitals</CardTitle>
            <CardDescription>
              Manage the list of partner hospitals for medical assistance programs.
            </CardDescription>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <HospitalFormDialog>
                  <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Hospital
                  </Button>
              </HospitalFormDialog>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={hospitals} filterColumnId="name" filterPlaceholder="Filter by name..." />
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MedicalRecord } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, hasDistrictScope } from '@/lib/access';
import { format, isValid } from 'date-fns';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Calendar, Stethoscope, Hospital, User, Users, MapPin, NotebookText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import MedicalFormDialog from '../_components/medical-form-dialog';
import DeleteMedicalAlert from '../_components/delete-medical-alert';

const formatDateSafely = (date: any): string => {
    if (!date) return 'N/A';
    const jsDate = date.toDate ? date.toDate() : new Date(date);
    if (!isValid(jsDate)) return 'Invalid Date';
    return format(jsDate, 'PPP');
};

const DetailItem = ({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon?: React.ElementType }) => (
    <div className="flex items-start gap-3">
        {Icon && <Icon className="w-5 h-5 text-muted-foreground mt-1" />}
        <div>
            <p className="text-sm font-semibold text-muted-foreground">{label}</p>
            <p className="text-base">{value || <span className='text-muted-foreground'>Not specified</span>}</p>
        </div>
    </div>
);


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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function AccessDenied() {
    return (
      <Card>
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view this page or this specific record.</p></CardContent>
      </Card>
    );
}

export default function MedicalRecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.recordId as string;
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile, isPlatformAdminClaim, roles } = useAuth();
  const authOpts = { isPlatformAdminClaim, roles };

  const canView = canViewPage(userProfile, 'projects_medical', authOpts);

  useEffect(() => {
    if (!recordId || !canView || !userProfile) {
        setLoading(false);
        return;
    };
    
    const unsub = onSnapshot(doc(db, 'medicalRecords', recordId), (doc) => {
      if (doc.exists()) {
        const recordData = { id: doc.id, ...doc.data() } as MedicalRecord;
        if (hasDistrictScope(userProfile, recordData.districtId, authOpts)) {
            setRecord(recordData);
        } else {
            setRecord(null);
        }
      } else {
        setRecord(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching medical record:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [recordId, userProfile, canView, authOpts]);

  if (loading) {
    return <DetailPageSkeleton />;
  }
  
  if (!record) {
    notFound();
  }

  if (!canView || !hasDistrictScope(userProfile, record.districtId, authOpts)) {
    return <AccessDenied />;
  }
  
  const canEdit = canDo(userProfile, 'projects_medical', 'update', authOpts);
  const canDelete = canDo(userProfile, 'projects_medical', 'delete', authOpts);
  const isAssistance = record.projectType === 'medical_assistance';
  
  const handleSuccessDelete = () => {
    router.push('/medical');
  };

  return (
    <div className="grid gap-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-bold">{isAssistance ? record.fullName : record.title}</CardTitle>
                        <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                            <Badge variant="secondary" className="capitalize">{record.projectType.replace('_', ' ')}</Badge>
                            <span>&bull;</span>
                            <span>{record.projectId}</span>
                        </div>
                    </div>
                    <div className='flex gap-2'>
                        {canEdit && (
                            <MedicalFormDialog record={record}>
                                <Button variant="outline"><Edit className="mr-2 h-4 w-4"/>Edit Record</Button>
                            </MedicalFormDialog>
                        )}
                        {canDelete && (
                            <DeleteMedicalAlert recordId={record.id} recordName={record.projectId} onSuccess={handleSuccessDelete}>
                                 <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</Button>
                            </DeleteMedicalAlert>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    <DetailItem label="Event Date" value={formatDateSafely(record.eventDate)} icon={Calendar} />
                    <DetailItem label="District" value={record.districtName} icon={MapPin} />
                    <DetailItem label="Barangay" value={record.brgyName} icon={MapPin} />
                </div>
            </CardContent>
        </Card>
        
        {isAssistance ? (
            <>
                <Card>
                    <CardHeader><CardTitle>Beneficiary Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailItem label="Full Name" value={record.fullName} icon={User} />
                            <DetailItem label="Contact" value={record.contact} />
                            <DetailItem label="Address" value={record.address} />
                            <DetailItem label="Birthday" value={formatDateSafely(record.birthday)} />
                            <DetailItem label="Household Size" value={record.householdSize} icon={Users} />
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Assistance & Referral</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailItem label="Hospital" value={record.hospital} icon={Hospital} />
                            <DetailItem label="Assistance Type" value={record.assistanceType} icon={Stethoscope} />
                            <DetailItem label="Referred By" value={record.referralDetails?.coordinatorName} icon={User} />
                            <DetailItem label="Date Referred" value={formatDateSafely(record.referralDetails?.dateReferred)} />
                            <DetailItem label="Date Approved" value={formatDateSafely(record.referralDetails?.dateApproved)} />
                        </div>
                    </CardContent>
                </Card>
            </>
        ) : (
            <Card>
                <CardHeader><CardTitle>Medical Drive Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <DetailItem label="Description" value={record.description} icon={NotebookText} />
                     <DetailItem label="Beneficiary Count" value={record.beneficiaryCount} icon={Users} />
                </CardContent>
            </Card>
        )}
    </div>
  );
}

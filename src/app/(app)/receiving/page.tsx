'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, AlertTriangle, Play, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { RequestRecord, RequestStatus } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo, isPlatformAdmin, isOIC } from '@/lib/access';
import { updateRequestStatus } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from './data-table';
import { columns as baseColumns } from './columns';
import { ColumnDef } from '@tanstack/react-table';
import RequestFormDialog from './_components/request-form-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

export default function ReceivingPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; requestId: string; action: 'approved' | 'rejected' | null }>({ open: false, requestId: '', action: null });
  const [reviewNotes, setReviewNotes] = useState('');

  const authOpts = { isPlatformAdminClaim };
  const canView = canViewPage(userProfile, 'receiving', authOpts);
  const canCreate = canDo(userProfile, 'receiving', 'create', authOpts);
  const canApprove = isPlatformAdmin(userProfile, isPlatformAdminClaim) || isOIC(userProfile);

  useEffect(() => {
    if (!canView || !userProfile) {
      setLoading(false);
      return;
    }

    const requestsCollection = collection(db, 'requests');
    let requestsQuery = query(requestsCollection);

    const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim) || isOIC(userProfile);

    if (!isAdmin && userProfile.access.districtIds.length > 0) {
      requestsQuery = query(requestsCollection, where('districtId', 'in', userProfile.access.districtIds));
    } else if (!isAdmin && userProfile.access.districtIds.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(requestsQuery, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as RequestRecord));
      setRequests(items);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching requests:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [canView, userProfile, isPlatformAdminClaim]);

  const handleStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    if (!user) return;
    if (newStatus === 'approved' || newStatus === 'rejected') {
      setReviewDialog({ open: true, requestId, action: newStatus });
      return;
    }
    const result = await updateRequestStatus(requestId, newStatus, await user!.getIdToken());
    if (result.success) {
      toast({ title: 'Status Updated', description: `Request moved to ${newStatus.replace('_', ' ')}.` });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const confirmReview = async () => {
    if (!user || !reviewDialog.action) return;
    const result = await updateRequestStatus(reviewDialog.requestId, reviewDialog.action, await user!.getIdToken(), reviewNotes || undefined);
    if (result.success) {
      toast({ title: 'Status Updated', description: `Request ${reviewDialog.action}.` });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setReviewDialog({ open: false, requestId: '', action: null });
    setReviewNotes('');
  };

  const filteredRequests = useMemo(
    () => (statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)),
    [requests, statusFilter],
  );

  const tableColumns = useMemo<ColumnDef<RequestRecord>[]>(() => {
    if (!canApprove) return baseColumns;

    const actionColumn: ColumnDef<RequestRecord> = {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const req = row.original;
        return (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {req.status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange(req.id, 'under_review')}>
                <Play className="h-3 w-3 mr-1" /> Review
              </Button>
            )}
            {req.status === 'under_review' && (
              <>
                <Button size="sm" variant="default" onClick={() => handleStatusChange(req.id, 'approved')}>
                  <CheckCircle className="h-3 w-3 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleStatusChange(req.id, 'rejected')}>
                  <XCircle className="h-3 w-3 mr-1" /> Reject
                </Button>
              </>
            )}
            {req.status === 'rejected' && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange(req.id, 'pending')}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reopen
              </Button>
            )}
          </div>
        );
      },
    };

    return [...baseColumns, actionColumn];
  }, [canApprove]);

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Receiving</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-96 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-black">Receiving</h1>
          <p className="text-muted-foreground">All received requests and resolutions.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={tableColumns}
            data={filteredRequests}
            toolbarChildren={
              <>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses ({requests.length})</SelectItem>
                    <SelectItem value="pending">Pending ({requests.filter(r => r.status === 'pending').length})</SelectItem>
                    <SelectItem value="under_review">Under Review ({requests.filter(r => r.status === 'under_review').length})</SelectItem>
                    <SelectItem value="approved">Approved ({requests.filter(r => r.status === 'approved').length})</SelectItem>
                    <SelectItem value="rejected">Rejected ({requests.filter(r => r.status === 'rejected').length})</SelectItem>
                  </SelectContent>
                </Select>
                {canCreate && (
                  <RequestFormDialog>
                    <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Request
                    </Button>
                  </RequestFormDialog>
                )}
              </>
            }
          />
        </CardContent>
      </Card>

      <AlertDialog open={reviewDialog.open} onOpenChange={(open) => { if (!open) { setReviewDialog({ open: false, requestId: '', action: null }); setReviewNotes(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewDialog.action === 'approved' ? 'Approve Request' : 'Reject Request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewDialog.action === 'approved'
                ? 'This request will be approved and routed to its designated sector page.'
                : 'This request will be rejected. You can add notes explaining why.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Review notes (optional)..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReview}>
              {reviewDialog.action === 'approved' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

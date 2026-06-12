'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Download, FolderArchive, GraduationCap, ListChecks, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import { useToast } from '@/hooks/use-toast';
import {
  getScholarshipApplications,
  exportScholarshipApplicationsCSV,
  type ScholarshipApplicationListItem,
} from '@/app/actions';
import { DataTable } from './data-table';
import { columns } from './columns';
import SubmissionDetailDialog from './_components/submission-detail-dialog';

export default function ScholarshipDashboardPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ScholarshipApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [selected, setSelected] = useState<ScholarshipApplicationListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const canView = canViewPage(userProfile, 'scholarship_applications', { isPlatformAdminClaim });

  const reload = useCallback(async () => {
    if (!user || !canView) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await getScholarshipApplications(token);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Failed to load applications', description: res.error });
        setItems([]);
      } else {
        setItems(res.data);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load applications', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [user, canView, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const stats = useMemo(() => {
    const total = items.length;
    const shortlisted = items.filter((a) => a.isShortlisted).length;
    return { total, shortlisted, notShortlisted: total - shortlisted };
  }, [items]);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const token = await user.getIdToken();
      const res = await exportScholarshipApplicationsCSV(token, 'all');
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Export failed', description: res.error });
        return;
      }
      // Use UTF-8 BOM so Excel opens the peso sign correctly.
      const blob = new Blob(['﻿', res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'CSV downloaded' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: err?.message });
    } finally {
      setExporting(false);
    }
  };

  const handleRegFormsZip = async () => {
    if (!user) return;
    setZipping(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/scholarship/reg-forms-zip', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ variant: 'destructive', title: 'Download failed', description: body.error ?? res.statusText });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `reg-forms-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'ZIP downloaded' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: err?.message });
    } finally {
      setZipping(false);
    }
  };

  const openDetail = (item: ScholarshipApplicationListItem) => {
    setSelected(item);
    setDetailOpen(true);
  };

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive" /> Access Denied
          </CardTitle>
          <CardDescription>You do not have access to scholarship applications.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recto Tulong Dunong Scholarship</h1>
          <p className="text-muted-foreground">
            Applications submitted through the public Tulong Dunong registration form.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats.total}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shortlisted</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold" style={{ color: '#00A8E8' }}>{stats.shortlisted}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Shortlisted</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats.notShortlisted}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Submissions</CardTitle>
              <CardDescription>Click any row to view full applicant details.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              onRowClick={openDetail}
              rightSlot={
                <div className="flex gap-2">
                  <Button onClick={handleExport} disabled={exporting} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    {exporting ? 'Exporting...' : 'Export CSV'}
                  </Button>
                  <Button onClick={handleRegFormsZip} disabled={zipping} variant="outline">
                    <FolderArchive className="mr-2 h-4 w-4" />
                    {zipping ? 'Zipping...' : 'Reg Forms ZIP'}
                  </Button>
                </div>
              }
            />
          )}
        </CardContent>
      </Card>

      <SubmissionDetailDialog
        application={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

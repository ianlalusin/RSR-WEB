'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Download, ExternalLink, GraduationCap, ListChecks, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import { useToast } from '@/hooks/use-toast';
import {
  getScholarshipApplications,
  type ScholarshipApplicationListItem,
} from '@/app/actions';
import { DataTable } from '../scholarship/data-table';
import { columns } from '../scholarship/columns';
import SubmissionDetailDialog from '../scholarship/_components/submission-detail-dialog';

const PUBLIC_FORM_URL = '/scholarship/apply';

/** Builds a single-sheet workbook from the loaded applications. */
function buildApplicationsWorkbook(items: ScholarshipApplicationListItem[]): XLSX.WorkBook {
  const rows = items.map((a) => ({
    'Date Submitted': a.createdAt ?? '',
    'Reference No.': a.referenceNo,
    'Last Name': a.lastName,
    'First Name': a.firstName,
    'Middle Name': a.middleName ?? '',
    'Suffix': a.suffix ?? '',
    'Date of Birth': a.dateOfBirth,
    'Sex': a.sex,
    'Civil Status': a.civilStatus,
    'Home Address': a.homeAddress,
    'City/Municipality': a.city,
    'Province': a.province,
    'Postal Code': a.postalCode ?? '',
    'Mobile': a.mobile,
    'Email': a.email,
    'Parent/Guardian': a.parentName,
    'Relationship': a.parentRelationship,
    'Parent Contact': a.parentContact,
    'Income Bracket': a.incomeBracket,
    'School': a.school,
    'Course': a.course,
    'Year Level': a.yearLevel,
    'Expected Graduation Year': a.expectedGraduationYear,
    'Shortlisted': a.isShortlisted ? 'YES' : 'NO',
    'Shortlist Reason': a.shortlistReason ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Applications');
  return wb;
}

export default function CHEDTulongDunongPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ScholarshipApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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

  const handleExportExcel = () => {
    if (items.length === 0) {
      toast({ title: 'Nothing to export', description: 'There are no applications yet.' });
      return;
    }
    setExporting(true);
    try {
      const wb = buildApplicationsWorkbook(items);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      XLSX.writeFile(wb, `ched-tulong-dunong-${stamp}.xlsx`);
      toast({ title: 'Excel downloaded' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: err?.message });
    } finally {
      setExporting(false);
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
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CHED Tulong Dunong</h1>
          <p className="text-muted-foreground">
            Applications submitted through the public Tulong Dunong registration form.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={PUBLIC_FORM_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            See Form
          </a>
        </Button>
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
          <CardTitle>Submissions</CardTitle>
          <CardDescription>Click any row to view full applicant details.</CardDescription>
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
                <Button onClick={handleExportExcel} disabled={exporting} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? 'Exporting...' : 'Download Excel'}
                </Button>
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

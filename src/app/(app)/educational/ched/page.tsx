'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { AlertTriangle, Download, ExternalLink, FolderArchive, GraduationCap, Layers, ListChecks, Lock, PauseCircle, PlayCircle, Settings, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import { useToast } from '@/hooks/use-toast';
import { computeFormStatus, yearLevelPriorityPoints } from '@/lib/scholarship-schools';
import type { ScholarshipFormConfig } from '@/lib/types/scholarship';
import {
  getScholarshipApplications,
  getScholarshipFormConfig,
  setScholarshipFormSuspended,
  finalizeScholarshipBatch,
  type ScholarshipApplicationListItem,
} from '@/app/actions';
import { DataTable } from '../scholarship/data-table';
import { columns } from '../scholarship/columns';
import SubmissionDetailDialog from '../scholarship/_components/submission-detail-dialog';
import FormSettingsDialog from '../scholarship/_components/form-settings-dialog';

const PUBLIC_FORM_URL = '/scholarship/apply';

/** Builds a single-sheet workbook for one batch, with per-batch row numbers. */
function buildApplicationsWorkbook(items: ScholarshipApplicationListItem[], batchNo: number): XLSX.WorkBook {
  // Number rows 1..N by submission time ascending (so #1 is the batch's first).
  const ordered = [...items].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  const rows = ordered.map((a, i) => ({
    'No.': i + 1,
    'Batch': a.batchNo ?? batchNo,
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
    'Barangay': a.barangay ?? '',
    'City/Municipality': a.city,
    'Province': a.province,
    'Mobile': a.mobile,
    'Email': a.email,
    'Parent/Guardian': a.parentName,
    'Relationship': a.parentRelationship,
    'Parent Contact': a.parentContact,
    'Income Bracket': a.incomeBracket,
    'Other Scholarship Grant': a.hasOtherScholarship === true ? 'Yes' : a.hasOtherScholarship === false ? 'No' : '',
    'Other Grant Details': a.otherScholarshipDetails ?? '',
    'School': a.school,
    'Course': a.course,
    'Year Level': a.yearLevel,
    'Expected Graduation Year': a.expectedGraduationYear,
    'Proof of Residency': a.proofOfResidency?.storagePath ? 'Uploaded' : 'Missing',
    'Has Proof of Residency ID': !!a.proofOfResidency?.storagePath,
    'Has Registration Form': !!(a as any).registrationForm?.storagePath,
    'Year Level Points': yearLevelPriorityPoints(a.yearLevel),
    'Priority Score': a.priorityScore ?? 0,
    'Shortlisted': a.isShortlisted ? 'YES' : 'NO',
    'Shortlist Reason': a.shortlistReason ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Batch ${batchNo}`);
  return wb;
}

export default function CHEDTulongDunongPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ScholarshipApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [selected, setSelected] = useState<ScholarshipApplicationListItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formConfig, setFormConfig] = useState<ScholarshipFormConfig | null>(null);
  const [currentBatchCount, setCurrentBatchCount] = useState(0);
  const [suspending, setSuspending] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  const canView = canViewPage(userProfile, 'scholarship_applications', { isPlatformAdminClaim });

  const currentBatch = formConfig?.currentBatch ?? 1;
  const selectedIsCurrent = selectedBatch != null && selectedBatch === currentBatch;
  const availableBatches = useMemo(
    () => Array.from({ length: currentBatch }, (_, i) => i + 1),
    [currentBatch],
  );

  const loadConfig = useCallback(async () => {
    if (!user || !canView) return;
    try {
      const token = await user.getIdToken();
      const res = await getScholarshipFormConfig(token);
      if (res.success) {
        setFormConfig(res.config);
        setCurrentBatchCount(res.responseCount);
        setSelectedBatch((prev) => (prev == null ? (res.config.currentBatch ?? 1) : prev));
      }
    } catch {
      // non-blocking; banner just won't show
    }
  }, [user, canView]);

  const toggleSuspend = useCallback(async () => {
    if (!user) return;
    const next = !(formConfig?.suspended ?? false);
    setSuspending(true);
    try {
      const token = await user.getIdToken();
      const res = await setScholarshipFormSuspended(next, token);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Could not update', description: res.error });
        return;
      }
      toast({ title: next ? 'Form acceptance paused' : 'Form acceptance resumed' });
      await loadConfig();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not update', description: err?.message });
    } finally {
      setSuspending(false);
    }
  }, [user, formConfig, toast, loadConfig]);

  const reload = useCallback(async () => {
    if (!user || !canView || selectedBatch == null) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await getScholarshipApplications(token, selectedBatch);
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
  }, [user, canView, toast, selectedBatch]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (selectedBatch != null) reload();
  }, [selectedBatch, reload]);

  const stats = useMemo(() => {
    const total = items.length;
    const shortlisted = items.filter((a) => a.isShortlisted).length;
    return { total, shortlisted, notShortlisted: total - shortlisted };
  }, [items]);

  // Form-acceptance banner always reflects the CURRENT batch, regardless of which
  // batch is being viewed.
  const formStatus = useMemo(
    () => (formConfig ? computeFormStatus(formConfig, currentBatchCount, Date.now()) : null),
    [formConfig, currentBatchCount],
  );

  const handleExportExcel = () => {
    if (items.length === 0) {
      toast({ title: 'Nothing to export', description: 'There are no responses in this batch.' });
      return;
    }
    setExporting(true);
    try {
      const batch = selectedBatch ?? currentBatch;
      const wb = buildApplicationsWorkbook(items, batch);
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `ched-tulong-dunong-batch-${batch}-${stamp}.xlsx`);
      toast({ title: `Batch ${batch} Excel downloaded` });
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
      const batch = selectedBatch ?? currentBatch;
      const res = await fetch(`/api/scholarship/reg-forms-zip?batch=${batch}`, {
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
      a.download = `reg-forms-batch${batch}-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `Batch ${batch} reg forms ZIP downloaded` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: err?.message });
    } finally {
      setZipping(false);
    }
  };

  const handleFinalizeBatch = async () => {
    if (!user) return;
    setSavingBatch(true);
    try {
      const token = await user.getIdToken();
      const res = await finalizeScholarshipBatch(token);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Could not save batch', description: res.error });
        return;
      }
      toast({
        title: `Batch ${res.finalizedBatch} saved (${res.count} responses)`,
        description: `New Batch ${res.newBatch} started. The form is now paused — open it when ready for the next batch.`,
      });
      setConfirmBatchOpen(false);
      await loadConfig();
      setSelectedBatch(res.newBatch);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not save batch', description: err?.message });
    } finally {
      setSavingBatch(false);
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

  const batchMeta = formConfig?.batches?.find((b) => b.no === selectedBatch);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CHED Tulong Dunong</h1>
          <p className="text-muted-foreground">
            Applications submitted through the public Tulong Dunong registration form.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {formConfig?.suspended ? (
            <Button
              onClick={toggleSuspend}
              disabled={suspending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {suspending ? 'Resuming…' : 'Resume Acceptance'}
            </Button>
          ) : (
            <Button variant="destructive" onClick={toggleSuspend} disabled={suspending}>
              <PauseCircle className="mr-2 h-4 w-4" />
              {suspending ? 'Suspending…' : 'Suspend Acceptance'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Form Settings
          </Button>
          <Button asChild variant="outline">
            <a href={PUBLIC_FORM_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              See Form
            </a>
          </Button>
        </div>
      </div>

      {formStatus && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-md border px-4 py-3 text-sm ${
            formStatus.open
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          <span className="font-semibold">
            {formStatus.suspended ? 'Form is PAUSED' : formStatus.open ? 'Form is OPEN' : 'Form is CLOSED'}
          </span>
          <span className="opacity-80">· Batch {currentBatch} · {currentBatchCount} response(s)</span>
          <span className="opacity-80">
            {!formStatus.suspended && formStatus.status === 'maxResponses' &&
              `· cap ${formStatus.maxResponses}`}
            {!formStatus.suspended && formStatus.status === 'deadline' &&
              formStatus.closesAtMs &&
              `· closes ${new Date(formStatus.closesAtMs).toLocaleString()}`}
          </span>
          {!formStatus.open && formStatus.reason && <span className="opacity-80">— {formStatus.reason}</span>}
        </div>
      )}

      {/* Batch selector + save-as-batch */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Viewing</span>
          <Select
            value={selectedBatch != null ? String(selectedBatch) : undefined}
            onValueChange={(v) => setSelectedBatch(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {availableBatches.map((n) => {
                const meta = formConfig?.batches?.find((b) => b.no === n);
                const label =
                  n === currentBatch
                    ? `Batch ${n} (current)`
                    : `Batch ${n}${meta ? ` · ${meta.count} locked` : ''}`;
                return (
                  <SelectItem key={n} value={String(n)}>
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {!selectedIsCurrent && batchMeta && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Locked
              {batchMeta.finalizedAtMs ? ` ${new Date(batchMeta.finalizedAtMs).toLocaleDateString()}` : ''}
            </span>
          )}
        </div>

        {selectedIsCurrent && (
          <Button onClick={() => setConfirmBatchOpen(true)} disabled={savingBatch}>
            <Lock className="mr-2 h-4 w-4" />
            Save this list as Batch {currentBatch}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Batch {selectedBatch ?? currentBatch} Responses</CardTitle>
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
          <CardTitle>Submissions — Batch {selectedBatch ?? currentBatch}</CardTitle>
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
                <div className="flex gap-2">
                  <Button onClick={handleExportExcel} disabled={exporting} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    {exporting ? 'Exporting...' : 'Download Excel'}
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

      <FormSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={loadConfig} />

      <AlertDialog open={confirmBatchOpen} onOpenChange={setConfirmBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Batch {currentBatch}?</AlertDialogTitle>
            <AlertDialogDescription>
              This locks the <strong>{currentBatchCount} response(s)</strong> currently in Batch {currentBatch}
              and starts <strong>Batch {currentBatch + 1}</strong> for new submissions (numbering restarts at 1).
              The form will be <strong>paused</strong> so you can re-open it for the next batch when ready.
              Locked batches are kept and remain downloadable. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingBatch}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleFinalizeBatch(); }} disabled={savingBatch}>
              {savingBatch ? 'Saving…' : `Save Batch ${currentBatch}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/components/providers/auth-provider';
import { logScholarshipApplicationView, type ScholarshipApplicationListItem } from '@/app/actions';

interface Props {
  application: ScholarshipApplicationListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'PPpp') : 'N/A';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm break-words">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

export default function SubmissionDetailDialog({ application, open, onOpenChange }: Props) {
  const { user } = useAuth();

  // Fire-and-forget audit log when a detail dialog opens.
  useEffect(() => {
    if (!open || !application || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        if (cancelled) return;
        await logScholarshipApplicationView(application.id, token);
      } catch {
        // non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, application, user]);

  if (!application) return null;
  const a = application;
  const fullName = [a.lastName, a.firstName, a.middleName, a.suffix].filter(Boolean).join(', ').replace(/, ,/g, ',');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg">
              {a.lastName}, {a.firstName} {a.middleName} {a.suffix}
            </DialogTitle>
            {a.isShortlisted ? (
              <Badge className="bg-green-600 text-white hover:bg-green-700">SHORTLISTED</Badge>
            ) : (
              <Badge variant="secondary">NOT SHORTLISTED</Badge>
            )}
          </div>
          <DialogDescription>
            Reference No. <span className="font-mono">{a.referenceNo}</span> &middot; submitted {fmt(a.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 pb-2">
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                Shortlisting
              </h3>
              <Field
                label="Reason"
                value={a.shortlistReason || (a.isShortlisted ? 'Matched the qualified list.' : 'Not shortlisted.')}
              />
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                Personal
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={fullName} />
                <Field label="Date of Birth" value={a.dateOfBirth} />
                <Field label="Sex" value={a.sex} />
                <Field label="Civil Status" value={a.civilStatus} />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                Contact
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Home Address" value={a.homeAddress} />
                <Field label="City / Municipality" value={a.city} />
                <Field label="Province" value={a.province} />
                <Field label="Postal Code" value={a.postalCode} />
                <Field label="Mobile" value={a.mobile} />
                <Field label="Email" value={a.email} />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                Parent / Guardian
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" value={a.parentName} />
                <Field label="Relationship" value={a.parentRelationship} />
                <Field label="Contact No." value={a.parentContact} />
                <Field label="Income Bracket" value={a.incomeBracket} />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                Educational
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="School" value={a.school} />
                <Field label="Course" value={a.course} />
                <Field label="Year Level" value={a.yearLevel} />
                <Field label="Expected Graduation Year" value={a.expectedGraduationYear} />
              </div>
            </section>

            <Separator />

            <section className="text-xs text-muted-foreground">
              <p>Consent given: {a.consentGiven ? 'Yes' : 'No'}</p>
              <p>Submitted: {fmt(a.createdAt)}</p>
              <p>Last updated: {fmt(a.updatedAt)}</p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

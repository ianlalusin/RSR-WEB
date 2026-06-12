'use client';

import { useEffect, useState } from 'react';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Loader2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { useAuth } from '@/components/providers/auth-provider';
import { storage } from '@/lib/firebase';
import { computePriorityScore, MAX_PRIORITY_SCORE, PRIORITY_HIGH_THRESHOLD } from '@/lib/scholarship-schools';
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
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const [regUrl, setRegUrl] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

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

  // Resolve the proof-of-residency image to a download URL (staff are
  // authenticated, so Storage read rules allow it).
  useEffect(() => {
    const path = application?.proofOfResidency?.storagePath;
    if (!open || !path) {
      setProofUrl(null);
      setProofError(null);
      setProofLoading(false);
      return;
    }
    let cancelled = false;
    setProofLoading(true);
    setProofError(null);
    (async () => {
      try {
        const url = await getDownloadURL(storageRef(storage, path));
        if (!cancelled) setProofUrl(url);
      } catch {
        if (!cancelled) setProofError('Could not load the uploaded ID.');
      } finally {
        if (!cancelled) setProofLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, application]);

  // Resolve the registration form file to a download URL.
  useEffect(() => {
    const path = (application as any)?.registrationForm?.storagePath;
    if (!open || !path) {
      setRegUrl(null);
      setRegError(null);
      setRegLoading(false);
      return;
    }
    let cancelled = false;
    setRegLoading(true);
    setRegError(null);
    (async () => {
      try {
        const url = await getDownloadURL(storageRef(storage, path));
        if (!cancelled) setRegUrl(url);
      } catch {
        if (!cancelled) setRegError('Could not load the registration form.');
      } finally {
        if (!cancelled) setRegLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, application]);

  if (!application) return null;
  const a = application;
  const fullName = [a.lastName, a.firstName, a.middleName, a.suffix].filter(Boolean).join(', ').replace(/, ,/g, ',');
  const priority = computePriorityScore({
    isShortlisted: a.isShortlisted,
    city: a.city,
    hasProof: !!a.proofOfResidency?.storagePath,
    hasOtherScholarship: a.hasOtherScholarship,
    yearLevel: a.yearLevel,
  });
  const priorityScore = a.priorityScore ?? priority.score;
  const priorityHigh = priorityScore >= PRIORITY_HIGH_THRESHOLD;
  const otherGrantLabel =
    a.hasOtherScholarship === true ? 'Yes' : a.hasOtherScholarship === false ? 'No' : '—';

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
                Priority &amp; Shortlisting
              </h3>
              <div className="mb-3 flex items-center gap-2">
                <Badge
                  className={priorityHigh ? 'bg-green-600 text-white hover:bg-green-700' : undefined}
                  variant={priorityHigh ? 'default' : 'secondary'}
                >
                  Priority {priorityScore}/{MAX_PRIORITY_SCORE}
                </Badge>
              </div>
              <ul className="mb-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                <li>{priority.breakdown.shortlisted ? '✓' : '—'} School &amp; course on the list</li>
                <li>{priority.breakdown.lipaCity ? '✓' : '—'} Resident of Lipa City</li>
                <li>{priority.breakdown.idUploaded ? '✓' : '—'} Government ID uploaded</li>
                <li>{priority.breakdown.noOtherScholarship ? '✓' : '—'} No other scholarship grant</li>
                <li className="sm:col-span-2">
                  Year level: <span className="font-medium">+{priority.breakdown.yearLevelPoints}</span>
                  {a.yearLevel ? ` (${a.yearLevel})` : ''}
                </li>
              </ul>
              <Field
                label="Shortlist Reason"
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
                <Field label="Barangay" value={a.barangay} />
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
                <Field label="Other Scholarship Grant" value={otherGrantLabel} />
                {a.hasOtherScholarship === true && (
                  <Field label="Other Grant Details" value={a.otherScholarshipDetails} />
                )}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                Proof of Residency
              </h3>
              {a.proofOfResidency?.storagePath ? (
                <div className="space-y-3">
                  {proofLoading && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading uploaded ID…
                    </p>
                  )}
                  {proofError && <p className="text-sm text-destructive">{proofError}</p>}
                  {proofUrl && (
                    <>
                      <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proofUrl}
                          alt="Government-issued ID"
                          className="max-h-72 rounded-md border object-contain"
                        />
                      </a>
                      <Button asChild variant="outline" size="sm">
                        <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open / Download ID
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not provided.</p>
              )}
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#00A8E8' }}>
                A.Y. 2025–2026 Registration Form
              </h3>
              {(a as any).registrationForm?.storagePath ? (
                <div className="space-y-3">
                  {regLoading && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading registration form…
                    </p>
                  )}
                  {regError && <p className="text-sm text-destructive">{regError}</p>}
                  {regUrl && (
                    <>
                      {(a as any).registrationForm?.contentType?.startsWith('image/') && (
                        <a href={regUrl} target="_blank" rel="noopener noreferrer" className="block w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={regUrl}
                            alt="A.Y. 2025–2026 Registration Form"
                            className="max-h-72 rounded-md border object-contain"
                          />
                        </a>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <a href={regUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open / Download Registration Form
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not provided.</p>
              )}
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

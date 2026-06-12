'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { getScholarshipFormConfig, updateScholarshipFormConfig } from '@/app/actions';
import type { ScholarshipFormStatusMode } from '@/lib/types/scholarship';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const STATUS_OPTIONS: { value: ScholarshipFormStatusMode; label: string }[] = [
  { value: 'open', label: 'Open — accept all answers' },
  { value: 'maxResponses', label: 'Limit by max responses' },
  { value: 'deadline', label: 'Limit by deadline (days/hours)' },
  { value: 'closed', label: 'Closed — stop accepting' },
];

function fmtDate(ms: number | null): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '—';
  }
}

export default function FormSettingsDialog({ open, onOpenChange, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ScholarshipFormStatusMode>('open');
  const [maxResponses, setMaxResponses] = useState('');
  const [days, setDays] = useState('');
  const [hours, setHours] = useState('');
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [currentClosesAtMs, setCurrentClosesAtMs] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await getScholarshipFormConfig(token);
        if (cancelled) return;
        if (res.success) {
          setStatus(res.config.status);
          setMaxResponses(res.config.maxResponses ? String(res.config.maxResponses) : '');
          setCurrentClosesAtMs(res.config.closesAtMs);
          setResponseCount(res.responseCount);
          setDays('');
          setHours('');
        } else {
          toast({ variant: 'destructive', title: 'Failed to load settings', description: res.error });
        }
      } catch (e: any) {
        if (!cancelled) toast({ variant: 'destructive', title: 'Failed to load settings', description: e?.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, toast]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await updateScholarshipFormConfig(
        {
          status,
          maxResponses: status === 'maxResponses' ? Number(maxResponses) : undefined,
          deadlineDays: status === 'deadline' ? Number(days || 0) : undefined,
          deadlineHours: status === 'deadline' ? Number(hours || 0) : undefined,
        },
        token,
      );
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Could not save', description: res.error });
        return;
      }
      toast({ title: 'Form settings saved' });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not save', description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Form Acceptance Window</DialogTitle>
          <DialogDescription>
            Control whether the public registration form accepts new answers.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            {responseCount !== null && (
              <p className="text-sm text-muted-foreground">
                Total responses so far: <span className="font-medium text-foreground">{responseCount}</span>
              </p>
            )}

            <div className="space-y-2">
              <Label>Acceptance rule</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ScholarshipFormStatusMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === 'maxResponses' && (
              <div className="space-y-2">
                <Label htmlFor="maxResponses">Maximum number of responses</Label>
                <Input
                  id="maxResponses"
                  type="number"
                  min={1}
                  value={maxResponses}
                  onChange={(e) => setMaxResponses(e.target.value)}
                  placeholder="e.g. 100"
                />
                <p className="text-xs text-muted-foreground">
                  The form closes automatically once this many applications are received.
                </p>
              </div>
            )}

            {status === 'deadline' && (
              <div className="space-y-2">
                <Label>Close after</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" />
                  </div>
                  <div className="flex-1">
                    <Input type="number" min={0} max={23} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Counted from when you save.{' '}
                  {currentClosesAtMs ? `Currently closes: ${fmtDate(currentClosesAtMs)}.` : ''}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="text-white"
            style={{ backgroundColor: '#00A8E8' }}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

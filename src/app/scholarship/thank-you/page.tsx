'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') ?? '';
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      toast({ title: 'Reference number copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy to clipboard' });
    }
  };

  return (
    <Card className="border-t-4" style={{ borderTopColor: '#00A8E8' }}>
      <CardHeader className="items-center text-center">
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(0, 168, 232, 0.12)' }}
        >
          <CheckCircle2 className="h-9 w-9" style={{ color: '#00A8E8' }} />
        </div>
        <CardTitle className="text-2xl">Application Received</CardTitle>
        <CardDescription className="max-w-md">
          Thank you for applying to the Recto Tulong Dunong Scholarship Program. Your
          application has been submitted successfully and will be reviewed by our team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {ref ? (
          <div className="rounded-md border p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your Reference Number
            </p>
            <p className="mt-1 break-all font-mono text-lg font-semibold" style={{ color: '#00A8E8' }}>
              {ref}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="mt-3"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy reference number
            </Button>
          </div>
        ) : null}

        <div className="rounded-md bg-muted/50 p-4 text-sm">
          <p className="mb-2 font-medium">What happens next?</p>
          <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
            <li>Please save your reference number for follow-up.</li>
            <li>Our team will validate your school and course against the official list.</li>
            <li>You will be contacted via the email or mobile number you provided.</li>
          </ul>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between">
          <Link href="/scholarship/apply" className="sm:w-auto">
            <Button variant="outline" className="w-full">Submit another application</Button>
          </Link>
          <span className="text-center text-xs text-muted-foreground sm:self-center">
            #aksyonaRYAN
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ScholarshipThankYouPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Loading...</div>}>
      <ThankYouContent />
    </Suspense>
  );
}

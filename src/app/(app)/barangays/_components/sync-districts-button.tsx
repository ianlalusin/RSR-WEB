'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { syncDistricts } from '@/app/actions';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SyncDistrictsButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const handleSync = async () => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Not authenticated' });
      return;
    }
    const actor = { uid: userProfile.uid, email: userProfile.email };

    setIsSyncing(true);
    try {
      const result = await syncDistricts(actor);
      if (result.success) {
        toast({
          title: 'Sync Complete',
          description: `${result.updatedCount} barangay districts have been aligned.`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Districts
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to sync districts?</AlertDialogTitle>
          <AlertDialogDescription>
            This will scan all barangays and align their district names with the standard list (e.g., "North" will become "North District"). This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSyncing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : 'Yes, Sync Data'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

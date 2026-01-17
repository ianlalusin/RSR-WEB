'use client';

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { deleteBarangay } from '@/app/actions';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

interface Props {
  barangayId: string;
  barangayName: string;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export default function DeleteBrgyAlert({ barangayId, barangayName, children, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const handleDelete = async () => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Not authenticated' });
      return;
    }
    const actor = { uid: userProfile.uid, email: userProfile.email };

    setIsDeleting(true);
    try {
      const result = await deleteBarangay(barangayId, actor);
      if (result.success) {
        toast({
          title: 'Barangay Deleted',
          description: `${barangayName} has been successfully deleted.`,
        });
        setIsOpen(false);
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the barangay
            <span className="font-bold"> {barangayName}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

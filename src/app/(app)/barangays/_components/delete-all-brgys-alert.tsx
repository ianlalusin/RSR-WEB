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
import { deleteAllBarangays } from '@/app/actions';
import { Loader2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  onSuccess?: () => void;
}

const CONFIRMATION_TEXT = "DELETE ALL";

export default function DeleteAllBrgysAlert({ onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const { toast } = useToast();

  const handleDelete = async () => {
    if (confirmationInput !== CONFIRMATION_TEXT) {
      toast({
        variant: 'destructive',
        title: 'Confirmation Failed',
        description: `Please type "${CONFIRMATION_TEXT}" to confirm deletion.`,
      });
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteAllBarangays();
      if (result.success) {
        toast({
          title: 'All Barangays Deleted',
          description: 'The barangay database has been cleared.',
        });
        setIsOpen(false);
        setConfirmationInput('');
        onSuccess?.();
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setConfirmationInput(''); // Reset on close
    }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete All Data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is irreversible and will permanently delete <span className="font-bold">ALL</span> barangay data from the database. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
            <Label htmlFor="confirmation" className="text-muted-foreground">
                To confirm, please type <span className="font-bold text-destructive">{CONFIRMATION_TEXT}</span> in the box below.
            </Label>
            <Input 
                id="confirmation"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                autoComplete="off"
                disabled={isDeleting}
            />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={isDeleting || confirmationInput !== CONFIRMATION_TEXT} 
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I understand, delete all data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

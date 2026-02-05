
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { addHospital, updateHospital } from '@/app/actions';
import type { Hospital } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  address: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  hospital?: Hospital;
  children: React.ReactNode;
  onSuccess?: () => void;
}

export default function HospitalFormDialog({ hospital, children, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isEditMode = !!hospital;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', address: '' },
  });
  
  useEffect(() => {
    if (isOpen) {
        form.reset(isEditMode ? { name: hospital.name, address: hospital.address || '' } : { name: '', address: '' });
    }
  }, [isOpen, hospital, form, isEditMode]);

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) return;
    const actor = { uid: userProfile.uid, email: userProfile.email };
    try {
      const result = isEditMode
        ? await updateHospital(hospital.id, values, actor)
        : await addHospital(values, actor);

      if (result.success) {
        toast({ title: `Hospital ${isEditMode ? 'updated' : 'added'}` });
        setIsOpen(false);
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Hospital' : 'Add New Hospital'}</DialogTitle>
           <DialogDescription>
            Manage accredited hospitals for medical assistance programs.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Hospital Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="address" render={({ field }) => ( <FormItem> <FormLabel>Address</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Hospital'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { updateCaptainProfile } from '@/app/actions';
import type { CaptainProfile } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, User } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const councilorSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    contact: z.string().optional(),
});

const formSchema = z.object({
  captain: z.object({
    name: z.string().min(1, 'Name is required'),
    address: z.string().optional(),
    contact: z.string().optional(),
    birthday: z.string().optional(),
    age: z.coerce.number().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
  secretary: z.object({
    name: z.string().optional(),
    contact: z.string().optional(),
  }),
  councilors: z.array(councilorSchema).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  brgyId: string;
  canEdit: boolean;
  children: React.ReactNode;
}

export default function CaptainProfileDialog({ brgyId, canEdit, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      captain: { name: '', address: '', contact: '', birthday: '', age: 0, email: '' },
      secretary: { name: '', contact: '' },
      councilors: [{ name: '', contact: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "councilors"
  });

  useEffect(() => {
    if (isOpen) {
      const fetchProfile = async () => {
        setIsFetching(true);
        const profileRef = doc(db, `barangays/${brgyId}/captainProfile/main`);
        const docSnap = await getDoc(profileRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as CaptainProfile;
          form.reset(data);
          setProfileExists(true);
        } else {
          form.reset();
          setProfileExists(false);
        }
        setIsFetching(false);
      };
      fetchProfile();
    }
  }, [isOpen, brgyId, form]);

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) {
      toast({ variant: 'destructive', title: 'Not authenticated' });
      return;
    }
    const actor = { uid: userProfile.uid, email: userProfile.email };
    setIsLoading(true);

    try {
      const result = await updateCaptainProfile(brgyId, !profileExists, values, actor);
      if (result.success) {
        toast({ title: 'Success', description: 'Captain profile has been updated.' });
        setIsOpen(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Captain Profile</DialogTitle>
          <DialogDescription>
            {canEdit ? 'Manage the barangay captain and councilor information.' : 'View the barangay captain and councilor information.'}
          </DialogDescription>
        </DialogHeader>
        {isFetching ? (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-1/3" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                </div>
            </div>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto p-2">
                
                {/* Captain */}
                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Captain</h3>
                    <FormField control={form.control} name="captain.name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="captain.contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="captain.email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="captain.address" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField control={form.control} name="captain.birthday" render={({ field }) => ( <FormItem><FormLabel>Birthday</FormLabel><FormControl><Input type="date" {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                {/* Secretary */}
                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Secretary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="secretary.name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="secretary.contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                {/* Councilors */}
                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Councilors</h3>
                        {canEdit && <Button type="button" size="sm" variant="outline" onClick={() => append({ name: '', contact: '' })}><PlusCircle className="mr-2"/>Add Councilor</Button>}
                    </div>
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-end gap-2">
                                <FormField control={form.control} name={`councilors.${index}.name`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Name</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name={`councilors.${index}.contact`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Contact</FormLabel><FormControl><Input {...field} disabled={!canEdit} /></FormControl><FormMessage /></FormItem> )} />
                                {canEdit && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="text-destructive"/></Button>}
                            </div>
                        ))}
                    </div>
                </div>

                {canEdit && (
                <DialogFooter className="sticky bottom-0 bg-background pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
                )}
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

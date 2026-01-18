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
import { Loader2, PlusCircle, Trash2, User, Edit } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';

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

const DetailItem = ({ label, value }: { label: string, value?: string | number | null }) => (
    <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm">{value || <span className='text-muted-foreground'>N/A</span>}</p>
    </div>
);

export default function CaptainProfileDialog({ brgyId, canEdit, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [profileData, setProfileData] = useState<CaptainProfile | null>(null);
  
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      captain: { name: '', address: '', contact: '', birthday: '', age: 0, email: '' },
      secretary: { name: '', contact: '' },
      councilors: [],
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
        setIsEditMode(false);
        const profileRef = doc(db, `barangays/${brgyId}/captainProfile/main`);
        const docSnap = await getDoc(profileRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as CaptainProfile;
          setProfileData(data);
          form.reset(data);
        } else {
          setProfileData(null);
          form.reset({
            captain: { name: '', address: '', contact: '', birthday: '', age: 0, email: '' },
            secretary: { name: '', contact: '' },
            councilors: [],
          });
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
      const result = await updateCaptainProfile(brgyId, !profileData, values, actor);
      if (result.success) {
        toast({ title: 'Success', description: 'Captain profile has been updated.' });
        setProfileData(values as CaptainProfile);
        setIsEditMode(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditClick = () => {
    if (!profileData) {
        form.reset({
            ...form.getValues(),
            councilors: [{ name: '', contact: '' }]
        });
    }
    setIsEditMode(true);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditMode && canEdit ? 'Edit Captain Profile' : 'Captain Profile'}</DialogTitle>
          <DialogDescription>
            {canEdit ? 'Manage the barangay captain and councilor information.' : 'View the barangay captain and councilor information.'}
          </DialogDescription>
        </DialogHeader>
        {isFetching ? (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-1/3" />
                <div className="space-y-2">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        ) : isEditMode && canEdit ? (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-6 max-h-[65vh] overflow-y-auto p-2">
                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Captain</h3>
                    <FormField control={form.control} name="captain.name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="captain.contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="captain.email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <div className="grid grid-cols-3 gap-4">
                        <FormField control={form.control} name="captain.address" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                         <FormField control={form.control} name="captain.birthday" render={({ field }) => ( <FormItem><FormLabel>Birthday</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                    <h3 className="font-semibold text-lg">Secretary</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="secretary.name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="secretary.contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Councilors</h3>
                        <Button type="button" size="sm" variant="outline" onClick={() => append({ name: '', contact: '' })}><PlusCircle className="mr-2"/>Add Councilor</Button>
                    </div>
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-end gap-2">
                                <FormField control={form.control} name={`councilors.${index}.name`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name={`councilors.${index}.contact`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Contact</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
                
              <DialogFooter className="pt-6">
                  <Button type="button" variant="secondary" onClick={() => setIsEditMode(false)}>Cancel</Button>
                  <Button type="submit" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                  </Button>
              </DialogFooter>
            </form>
            </Form>
        ) : (
            <>
                <div className="space-y-6 max-h-[65vh] overflow-y-auto p-4">
                    {!profileData ? (
                         <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
                            <User className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="font-semibold mb-2">No Profile Found</h3>
                            <p className="text-sm text-muted-foreground">No captain profile data exists for this barangay.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Captain</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailItem label="Name" value={profileData.captain.name} />
                                    <DetailItem label="Contact" value={profileData.captain.contact} />
                                    <DetailItem label="Email" value={profileData.captain.email} />
                                    <DetailItem label="Birthday" value={profileData.captain.birthday} />
                                    <div className="md:col-span-2">
                                      <DetailItem label="Address" value={profileData.captain.address} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold text-lg">Secretary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailItem label="Name" value={profileData.secretary?.name} />
                                    <DetailItem label="Contact" value={profileData.secretary?.contact} />
                                </div>
                            </div>
                            {profileData.councilors && profileData.councilors.length > 0 && (
                                <div className="space-y-4 p-4 border rounded-lg">
                                    <h3 className="font-semibold text-lg">Councilors</h3>
                                    <ul className="space-y-2">
                                        {profileData.councilors.map((c, i) => (
                                            c.name && <li key={i} className="flex justify-between items-center text-sm border-b pb-1 last:border-0">
                                                <span>{c.name}</span>
                                                <span className="text-muted-foreground">{c.contact}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
                 <DialogFooter className="pt-6">
                    <DialogClose asChild>
                        <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                    {canEdit && (
                        <Button onClick={handleEditClick}>
                            <Edit className="mr-2"/>
                            {profileData ? 'Edit Profile' : 'Create Profile'}
                        </Button>
                    )}
                </DialogFooter>
            </>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { addMedicalRecord, updateMedicalRecord } from '@/app/actions';
import type { MedicalRecord, MedicalProjectType, MedicalAssistanceType } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  projectType: z.enum(['medical_drive', 'medical_assistance']),
  districtId: z.string().min(1, "District is required"),
  districtName: z.string().min(1, "District is required"),
  brgyId: z.string().min(1, "Barangay is required"),
  brgyName: z.string().min(1, "Barangay is required"),
  eventDate: z.string().min(1, "Event date is required"),

  // Medical Drive fields
  title: z.string().optional(),
  description: z.string().optional(),
  beneficiaryCount: z.coerce.number().optional(),
  
  // Medical Assistance fields
  fullName: z.string().optional(),
  householdSize: z.coerce.number().optional(),
  hospital: z.string().optional(),
  assistanceType: z.enum(['operation', 'checkup', 'dental', 'medicine', 'other']).optional(),
  
  // Referral Details
  coordinatorId: z.string().optional(),
  coordinatorName: z.string().optional(),
  dateReferred: z.string().optional(),
  dateApproved: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.projectType === 'medical_drive') {
        if (!data.title) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Title is required for Medical Drive", path: ["title"] });
    }
    if (data.projectType === 'medical_assistance') {
        if (!data.fullName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Full Name is required for Medical Assistance", path: ["fullName"] });
        if (!data.assistanceType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Assistance Type is required", path: ["assistanceType"] });
    }
});


type FormValues = z.infer<typeof formSchema>;

interface Props {
  record?: MedicalRecord;
  children: React.ReactNode;
  onSuccess?: () => void;
}

const PROJECT_TYPES: {value: MedicalProjectType, label: string}[] = [
    { value: 'medical_drive', label: 'Medical Drive' },
    { value: 'medical_assistance', label: 'Medical Assistance' },
]
const ASSISTANCE_TYPES: {value: MedicalAssistanceType, label: string}[] = [
    { value: 'operation', label: 'Operation' },
    { value: 'checkup', label: 'Checkup' },
    { value: 'dental', label: 'Dental' },
    { value: 'medicine', label: 'Medicine' },
    { value: 'other', label: 'Other' },
]

export default function MedicalFormDialog({ record, children, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isEditMode = !!record;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: record ? {
        ...record,
        eventDate: record.eventDate.toDate().toISOString().split('T')[0],
        dateReferred: record.referralDetails?.dateReferred.toDate().toISOString().split('T')[0],
        dateApproved: record.referralDetails?.dateApproved.toDate().toISOString().split('T')[0],
    } : {
      projectType: 'medical_assistance',
    },
  });

  const projectType = form.watch('projectType');

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        return;
    }
    const actor = { uid: userProfile.uid, email: userProfile.email };
    
    // In a real app, you would convert date strings back to Timestamps
    const payload = { ...values } as any;

    try {
        let result;
        if (isEditMode) {
            result = await updateMedicalRecord(record.id, payload, actor);
        } else {
            result = await addMedicalRecord(payload, actor);
        }

        if (result.success) {
            toast({ title: `Record ${isEditMode ? 'updated' : 'added'}` });
            form.reset();
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Medical Record' : 'Add New Medical Record'}</DialogTitle>
          <DialogDescription>
            Fill in the details for the medical project or assistance.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[65vh] pr-4">
              <div className="space-y-6 py-4">
                 <FormField
                    control={form.control}
                    name="projectType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <FormControl>
                            <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                            >
                            {PROJECT_TYPES.map(type => (
                                <FormItem key={type.value} className="flex items-center space-x-2">
                                    <FormControl>
                                        <RadioGroupItem value={type.value} />
                                    </FormControl>
                                    <FormLabel className="font-normal">{type.label}</FormLabel>
                                </FormItem>
                            ))}
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />

                {projectType === 'medical_drive' && (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Drive Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="beneficiaryCount" render={({ field }) => ( <FormItem><FormLabel>Beneficiary Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                )}
                
                {projectType === 'medical_assistance' && (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="householdSize" render={({ field }) => ( <FormItem><FormLabel>Household Size</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="hospital" render={({ field }) => ( <FormItem><FormLabel>Hospital</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="assistanceType" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Assistance Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {ASSISTANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                )}

                <div className='space-y-4 p-4 border rounded-lg'>
                    <h3 className="font-semibold text-md">Location & Date</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* In a real app, these would be dynamic selects */}
                        <FormField control={form.control} name="districtName" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="brgyName" render={({ field }) => ( <FormItem><FormLabel>Barangay</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="eventDate" render={({ field }) => ( <FormItem><FormLabel>Event Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                
                 {projectType === 'medical_assistance' && (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <h3 className="font-semibold text-md">Referral Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="coordinatorName" render={({ field }) => ( <FormItem><FormLabel>Coordinator Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="dateReferred" render={({ field }) => ( <FormItem><FormLabel>Date Referred</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="dateApproved" render={({ field }) => ( <FormItem><FormLabel>Date Approved</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                 )}

              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Record'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

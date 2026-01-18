'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { addAssistanceRecord, updateAssistanceRecord } from '@/app/actions';
import type { AssistanceRecord, Barangay, AssistanceSector, RecordStatus, ValueType } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  eventDate: z.date({ required_error: "An event date is required." }),
  beneficiaryCount: z.coerce.number().int().positive('Must be a positive number.'),
  valueAmount: z.coerce.number().nonnegative('Must be a non-negative number.'),
  valueType: z.enum(["cash", "in-kind", "service"]),
  status: z.enum(["draft", "submitted", "approved", "released", "archived"]),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  barangay: Barangay;
  sector: AssistanceSector;
  record?: AssistanceRecord;
  children: React.ReactNode;
  onSuccess?: () => void;
}

const valueTypes: ValueType[] = ["cash", "in-kind", "service"];
const statuses: RecordStatus[] = ["draft", "submitted", "approved", "released", "archived"];

export default function AssistanceFormDialog({ barangay, sector, record, children, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isEditMode = !!record;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: record?.title || '',
      description: record?.description || '',
      eventDate: record?.eventDate ? (record.eventDate as any).toDate() : new Date(),
      beneficiaryCount: record?.beneficiaryCount || 0,
      valueAmount: record?.valueAmount || 0,
      valueType: record?.valueType || 'cash',
      status: record?.status || 'draft',
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        return;
    }
    const actor = { uid: userProfile.uid, email: userProfile.email };

    try {
      let result;
      if (isEditMode) {
        result = await updateAssistanceRecord(record.id, values, actor);
      } else {
        const newRecordData = {
          ...values,
          brgyId: barangay.id,
          districtId: barangay.districtId,
          sector: sector,
        }
        result = await addAssistanceRecord(newRecordData, actor);
      }

      if (result.success) {
        toast({
          title: `Record ${isEditMode ? 'updated' : 'added'}`,
          description: `${values.title} has been successfully ${isEditMode ? 'updated' : 'saved'}.`,
        });
        form.reset();
        setIsOpen(false);
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Operation Failed',
        description: error.message || 'An unknown error occurred.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add'} {sector} Record</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update the details for this record.` : `Fill in the details for the new record for Brgy. ${barangay.name}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[65vh] overflow-y-auto p-2">
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Event Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value ? (
                                format(field.value, "PPP")
                            ) : (
                                <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="beneficiaryCount" render={({ field }) => ( <FormItem><FormLabel>Beneficiaries</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="valueAmount" render={({ field }) => ( <FormItem><FormLabel>Value (PHP)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="valueType" render={({ field }) => ( <FormItem><FormLabel>Value Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{valueTypes.map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{statuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
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

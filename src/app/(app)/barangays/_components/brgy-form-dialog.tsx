'use client';

import { useState } from 'react';
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
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { addBarangay, updateBarangay } from '@/app/actions';
import type { Barangay } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  districtName: z.string().min(1, 'District is required.'),
  population: z.coerce.number().int().positive('Must be a positive number.'),
  votingPopulation: z.coerce.number().int().positive('Must be a positive number.'),
  rsrVotes: z.coerce.number().int().nonnegative('Must be a non-negative number.'),
  isWin: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  barangay?: Barangay;
  children: React.ReactNode;
  onSuccess?: () => void;
}

const districts = [
    "North District",
    "South District",
    "East District",
    "West District",
    "Urban District",
];

export default function BrgyFormDialog({ barangay, children, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const isEditMode = !!barangay;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: barangay?.name || '',
      districtName: barangay?.districtName || '',
      population: barangay?.population || 0,
      votingPopulation: barangay?.votingPopulation || 0,
      rsrVotes: barangay?.rsrVotes || 0,
      isWin: barangay?.isWin || false,
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        return;
    }
    const actorToken = await user!.getIdToken();

    try {
      const favoredVotePct = values.votingPopulation > 0 ? (values.rsrVotes / values.votingPopulation) * 100 : 0;
      let result;
      if (isEditMode) {
        result = await updateBarangay(barangay.id, { ...values, favoredVotePct }, actorToken);
      } else {
        const newBrgyData = {
          ...values,
          favoredVotePct,
          districtId: values.districtName.toLowerCase().replace(/\s/g, '-'),
          congVisitCount: 0,
          coordinatorUids: [],
        }
        result = await addBarangay(newBrgyData, actorToken);
      }

      if (result.success) {
        toast({
          title: `Barangay ${isEditMode ? 'updated' : 'added'}`,
          description: `${values.name} has been successfully ${isEditMode ? 'updated' : 'added'}.`,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Barangay' : 'Add New Barangay'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Update the details for ${barangay.name}.` : 'Fill in the details for the new barangay.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., San Antonio" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="districtName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>District</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a district" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {districts.map((district) => (
                                <SelectItem key={district} value={district}>
                                    {district}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="population"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Population</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="votingPopulation"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Voters</FormLabel>
                    <FormControl>
                        <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rsrVotes"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>RSR Votes</FormLabel>
                      <FormControl>
                          <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                control={form.control}
                name="isWin"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Win Status</FormLabel>
                        <FormControl>
                            <div className="flex items-center space-x-2 h-10">
                                <Switch
                                    id="isWin-switch"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                                <Label htmlFor="isWin-switch">{field.value ? 'Win' : 'Lose'}</Label>
                            </div>
                        </FormControl>
                    </FormItem>
                )}
                />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Barangay'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

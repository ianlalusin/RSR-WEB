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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { addBarangay, updateBarangay } from '@/app/actions';
import type { Barangay } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';

const DEFAULT_CYCLE_YEAR = String(new Date().getFullYear());

const editSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  districtName: z.string().min(1, 'District is required.'),
  population: z.coerce.number().int().positive('Must be a positive number.'),
});

const createSchema = editSchema.extend({
  cycleYear: z.string().regex(/^\d{4}$/, 'Year must be a 4-digit year.'),
  votingPopulation: z.coerce.number().int().nonnegative('Must be 0 or greater.'),
  rsrVotes: z.coerce.number().int().nonnegative('Must be 0 or greater.'),
  isWin: z.boolean().default(false),
});

type EditValues = z.infer<typeof editSchema>;
type CreateValues = z.infer<typeof createSchema>;

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

  const form = useForm<CreateValues>({
    resolver: zodResolver(isEditMode ? editSchema : createSchema) as any,
    defaultValues: {
      name: barangay?.name || '',
      districtName: barangay?.districtName || '',
      population: barangay?.population || 0,
      cycleYear: DEFAULT_CYCLE_YEAR,
      votingPopulation: 0,
      rsrVotes: 0,
      isWin: false,
    },
  });

  const onSubmit = async (values: CreateValues) => {
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
        return;
    }
    const actorToken = await user!.getIdToken();

    try {
      let result;
      if (isEditMode) {
        const editValues: EditValues = {
          name: values.name,
          districtName: values.districtName,
          population: values.population,
        };
        result = await updateBarangay(barangay.id, {
          ...editValues,
          districtId: editValues.districtName.toLowerCase().replace(/\s/g, '-'),
        }, actorToken);
      } else {
        const favoredVotePct = values.votingPopulation > 0 ? (values.rsrVotes / values.votingPopulation) * 100 : 0;
        result = await addBarangay({
          name: values.name,
          districtName: values.districtName,
          districtId: values.districtName.toLowerCase().replace(/\s/g, '-'),
          population: values.population,
          congVisitCount: 0,
          coordinatorUids: [],
          cycleYear: values.cycleYear,
          cycleStats: {
            votingPopulation: values.votingPopulation,
            rsrVotes: values.rsrVotes,
            favoredVotePct,
            isWin: values.isWin,
          },
        }, actorToken);
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Barangay' : 'Add New Barangay'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? `Update the demographic details for ${barangay.name}. Electoral results and officials are edited per cycle from the Captain Profile dialog.`
              : 'Fill in the barangay details. Initial election results below will be saved as the first cycle.'}
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

            {!isEditMode && (
              <>
                <div className="border-t pt-4">
                  <h4 className="font-medium text-sm mb-1">Initial Election Cycle</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    These values create the first cycle record. Add more cycles later from the Captain Profile dialog.
                  </p>
                  <FormField
                    control={form.control}
                    name="cycleYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Election Year</FormLabel>
                        <FormControl>
                          <Input placeholder="2025" {...field} />
                        </FormControl>
                        <FormDescription>4-digit year, e.g. 2025 or 2028.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                <FormField
                  control={form.control}
                  name="isWin"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Result</FormLabel>
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
              </>
            )}

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

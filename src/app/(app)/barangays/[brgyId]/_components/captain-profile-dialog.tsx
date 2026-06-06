'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { setCurrentCycle, upsertBarangayCycle } from '@/app/actions';
import type { BarangayCycle } from '@/lib/types';
import { Loader2, PlusCircle, Trash2, User, Edit, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ADD_NEW_CYCLE = '__ADD_NEW__';

const councilorSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    contact: z.string().optional(),
});

const formSchema = z.object({
  votingPopulation: z.coerce.number().int().nonnegative(),
  rsrVotes: z.coerce.number().int().nonnegative(),
  isWin: z.boolean().default(false),
  captain: z.object({
    name: z.string().min(1, 'Name is required'),
    photoURL: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
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
  currentCycle?: string;
  canEdit: boolean;
  children: React.ReactNode;
}

const emptyFormValues: FormValues = {
  votingPopulation: 0,
  rsrVotes: 0,
  isWin: false,
  captain: { name: '', photoURL: '', address: '', contact: '', birthday: '', age: 0, email: '' },
  secretary: { name: '', contact: '' },
  councilors: [],
};

const DetailItem = ({ label, value }: { label: string, value?: string | number | null }) => (
    <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm">{value || <span className='text-muted-foreground'>N/A</span>}</p>
    </div>
);

export default function CaptainProfileDialog({ brgyId, currentCycle, canEdit, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [cycles, setCycles] = useState<BarangayCycle[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [addCycleOpen, setAddCycleOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');

  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyFormValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "councilors"
  });

  const selectedCycle = useMemo(
    () => cycles.find(c => c.year === selectedYear) ?? null,
    [cycles, selectedYear]
  );

  useEffect(() => {
    if (!isOpen) return;
    setIsFetching(true);
    setIsEditMode(false);

    const cyclesRef = collection(db, `barangays/${brgyId}/cycles`);
    const unsub = onSnapshot(cyclesRef, snapshot => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as BarangayCycle))
        .sort((a, b) => b.year.localeCompare(a.year));
      setCycles(list);
      setSelectedYear(prev => {
        if (prev && list.some(c => c.year === prev)) return prev;
        if (currentCycle && list.some(c => c.year === currentCycle)) return currentCycle;
        return list[0]?.year ?? null;
      });
      setIsFetching(false);
    }, () => setIsFetching(false));

    return () => unsub();
  }, [isOpen, brgyId, currentCycle]);

  useEffect(() => {
    if (isEditMode) return;
    if (selectedCycle) {
      form.reset({
        votingPopulation: selectedCycle.votingPopulation ?? 0,
        rsrVotes: selectedCycle.rsrVotes ?? 0,
        isWin: selectedCycle.isWin ?? false,
        captain: {
          name: selectedCycle.captain?.name ?? '',
          photoURL: selectedCycle.captain?.photoURL ?? '',
          address: selectedCycle.captain?.address ?? '',
          contact: selectedCycle.captain?.contact ?? '',
          birthday: selectedCycle.captain?.birthday ?? '',
          age: selectedCycle.captain?.age ?? 0,
          email: selectedCycle.captain?.email ?? '',
        },
        secretary: {
          name: selectedCycle.secretary?.name ?? '',
          contact: selectedCycle.secretary?.contact ?? '',
        },
        councilors: selectedCycle.councilors ?? [],
      });
    } else {
      form.reset(emptyFormValues);
    }
  }, [selectedCycle, isEditMode, form]);

  const handleYearChange = (value: string) => {
    if (value === ADD_NEW_CYCLE) {
      setNewYearInput('');
      setAddCycleOpen(true);
      return;
    }
    setSelectedYear(value);
    setIsEditMode(false);
  };

  const submitNewCycle = async () => {
    if (!/^\d{4}$/.test(newYearInput)) {
      toast({ variant: 'destructive', title: 'Invalid year', description: 'Enter a 4-digit year, e.g. 2028.' });
      return;
    }
    if (cycles.some(c => c.year === newYearInput)) {
      toast({ variant: 'destructive', title: 'Cycle already exists', description: `Cycle ${newYearInput} is already on file.` });
      return;
    }
    if (!userProfile || !user) return;

    setIsLoading(true);
    try {
      const actorToken = await user.getIdToken();
      const result = await upsertBarangayCycle(brgyId, newYearInput, {
        votingPopulation: 0,
        rsrVotes: 0,
        favoredVotePct: 0,
        isWin: false,
        captain: { name: '' },
        secretary: {},
        councilors: [],
      }, actorToken);
      if (!result.success) throw new Error(result.error);
      setSelectedYear(newYearInput);
      setIsEditMode(true);
      setAddCycleOpen(false);
      toast({ title: 'Cycle created', description: `Cycle ${newYearInput} added. Fill in the details and save.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to create cycle', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!userProfile || !user || !selectedYear) {
      toast({ variant: 'destructive', title: 'Not authenticated' });
      return;
    }
    setIsLoading(true);

    try {
      const actorToken = await user.getIdToken();
      const favoredVotePct = values.votingPopulation > 0
        ? (values.rsrVotes / values.votingPopulation) * 100
        : 0;
      const result = await upsertBarangayCycle(brgyId, selectedYear, {
        ...values,
        favoredVotePct,
      }, actorToken);
      if (result.success) {
        toast({ title: 'Saved', description: `Cycle ${selectedYear} updated.` });
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

  const handleSetCurrent = async () => {
    if (!user || !selectedYear) return;
    setIsLoading(true);
    try {
      const actorToken = await user.getIdToken();
      const result = await setCurrentCycle(brgyId, selectedYear, actorToken);
      if (!result.success) throw new Error(result.error);
      toast({ title: 'Current cycle updated', description: `Cycle ${selectedYear} is now the active cycle.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentCycle = selectedYear !== null && selectedYear === currentCycle;
  const hasCycles = cycles.length > 0;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isEditMode && canEdit ? `Edit Cycle ${selectedYear ?? ''}` : 'Captain & Cycle Profile'}</DialogTitle>
            <DialogDescription>
              {canEdit
                ? 'Manage officials and electoral results per election cycle. Past cycles are preserved.'
                : 'View officials and electoral results for each recorded election cycle.'}
            </DialogDescription>
          </DialogHeader>

          {/* Cycle selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="cycle-select" className="text-sm">Election Cycle</Label>
            </div>
            <Select value={selectedYear ?? undefined} onValueChange={handleYearChange} disabled={isEditMode}>
              <SelectTrigger id="cycle-select" className="w-[200px]">
                <SelectValue placeholder={hasCycles ? 'Select a cycle' : 'No cycles yet'} />
              </SelectTrigger>
              <SelectContent>
                {cycles.map(c => (
                  <SelectItem key={c.year} value={c.year}>
                    {c.year}{c.year === currentCycle ? ' (current)' : ''}
                  </SelectItem>
                ))}
                {canEdit && (
                  <SelectItem value={ADD_NEW_CYCLE}>+ Add new cycle…</SelectItem>
                )}
              </SelectContent>
            </Select>
            {isCurrentCycle && (
              <Badge variant="outline" className="gap-1 text-green-700 border-green-300">
                <CheckCircle2 className="w-3 h-3" /> Active cycle
              </Badge>
            )}
            {canEdit && selectedCycle && !isCurrentCycle && !isEditMode && (
              <Button variant="ghost" size="sm" onClick={handleSetCurrent} disabled={isLoading}>
                Set as current
              </Button>
            )}
          </div>

          {isFetching ? (
              <div className="space-y-4 p-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-32 w-full" />
              </div>
          ) : !hasCycles ? (
              <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                  <CalendarClock className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Cycles Recorded</h3>
                  <p className="text-sm text-muted-foreground mb-4">No election cycles exist for this barangay yet.</p>
                  {canEdit && (
                      <Button onClick={() => { setNewYearInput(String(new Date().getFullYear())); setAddCycleOpen(true); }}>
                          <PlusCircle className="mr-2 w-4 h-4" /> Add first cycle
                      </Button>
                  )}
              </div>
          ) : isEditMode && canEdit ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <div className="space-y-6 max-h-[60vh] overflow-y-auto p-2">
                      <div className="space-y-4 p-4 border rounded-lg">
                          <h3 className="font-semibold text-lg">Election Results · {selectedYear}</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="votingPopulation" render={({ field }) => ( <FormItem><FormLabel>Voting Population</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="rsrVotes" render={({ field }) => ( <FormItem><FormLabel>RSR Votes</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          </div>
                          <FormField control={form.control} name="isWin" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Result</FormLabel><FormControl><div className="flex items-center space-x-2 h-10"><Switch id="cycle-iswin" checked={field.value} onCheckedChange={field.onChange} /><Label htmlFor="cycle-iswin">{field.value ? 'Win' : 'Lose'}</Label></div></FormControl></FormItem> )} />
                      </div>

                      <div className="space-y-4 p-4 border rounded-lg">
                          <h3 className="font-semibold text-lg">Captain</h3>
                          <FormField control={form.control} name="captain.name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                          <FormField control={form.control} name="captain.photoURL" render={({ field }) => ( <FormItem><FormLabel>Photo URL</FormLabel><FormControl><Input placeholder="https://example.com/image.png" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="captain.contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="captain.email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                          </div>
                          <FormField control={form.control} name="captain.address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="captain.birthday" render={({ field }) => ( <FormItem><FormLabel>Birthday</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="captain.age" render={({ field }) => ( <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                          </div>
                      </div>

                      <div className="space-y-4 p-4 border rounded-lg">
                          <h3 className="font-semibold text-lg">Secretary</h3>
                          <div className="grid grid-cols-2 gap-4">
                              <FormField control={form.control} name="secretary.name" render={({ field }) => ( <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                              <FormField control={form.control} name="secretary.contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
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
                                      <FormField control={form.control} name={`councilors.${index}.contact`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Contact</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
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
                  <div className="space-y-6 max-h-[60vh] overflow-y-auto p-4">
                      {selectedCycle && (
                          <>
                              <div className="grid gap-3 sm:grid-cols-3 p-4 border rounded-lg">
                                  <DetailItem label="Voting Population" value={selectedCycle.votingPopulation?.toLocaleString()} />
                                  <DetailItem label="RSR Votes" value={selectedCycle.rsrVotes?.toLocaleString()} />
                                  <DetailItem label="Result" value={selectedCycle.isWin ? 'Win' : 'Lose'} />
                              </div>
                              <div className="space-y-4 p-4 border rounded-lg">
                                  <div className="flex items-center gap-4">
                                      <Avatar className="w-20 h-20 border">
                                          <AvatarImage src={selectedCycle.captain?.photoURL || undefined} alt={selectedCycle.captain?.name} />
                                          <AvatarFallback className="text-2xl">
                                              {selectedCycle.captain?.name ? selectedCycle.captain.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : <User />}
                                          </AvatarFallback>
                                      </Avatar>
                                      <div>
                                          <h3 className="font-semibold text-2xl">{selectedCycle.captain?.name || 'Unnamed'}</h3>
                                          <p className="text-sm text-muted-foreground">Barangay Captain · Cycle {selectedCycle.year}</p>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t mt-4">
                                      <DetailItem label="Contact" value={selectedCycle.captain?.contact} />
                                      <DetailItem label="Email" value={selectedCycle.captain?.email} />
                                      <DetailItem label="Birthday" value={selectedCycle.captain?.birthday} />
                                      <DetailItem label="Age" value={selectedCycle.captain?.age && selectedCycle.captain.age > 0 ? selectedCycle.captain.age : undefined} />
                                      <div className="md:col-span-2">
                                          <DetailItem label="Address" value={selectedCycle.captain?.address} />
                                      </div>
                                  </div>
                              </div>
                              <div className="space-y-4 p-4 border rounded-lg">
                                  <h3 className="font-semibold text-lg">Secretary</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <DetailItem label="Name" value={selectedCycle.secretary?.name} />
                                      <DetailItem label="Contact" value={selectedCycle.secretary?.contact} />
                                  </div>
                              </div>
                              {selectedCycle.councilors && selectedCycle.councilors.length > 0 && (
                                  <div className="space-y-4 p-4 border rounded-lg">
                                      <h3 className="font-semibold text-lg">Councilors</h3>
                                      <ul className="space-y-2">
                                          {selectedCycle.councilors.map((c, i) => (
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
                      {canEdit && selectedCycle && (
                          <Button onClick={() => setIsEditMode(true)}>
                              <Edit className="mr-2"/> Edit Cycle {selectedCycle.year}
                          </Button>
                      )}
                  </DialogFooter>
              </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={addCycleOpen} onOpenChange={setAddCycleOpen}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Add Election Cycle</AlertDialogTitle>
                  <AlertDialogDescription>
                      Enter the 4-digit year for the new election cycle. A blank record will be created — fill in officials and results next.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                  <Label htmlFor="new-cycle-year">Election Year</Label>
                  <Input
                      id="new-cycle-year"
                      placeholder="2028"
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value.trim())}
                      maxLength={4}
                  />
              </div>
              <AlertDialogFooter>
                  <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={(e) => { e.preventDefault(); submitNewCycle(); }} disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Cycle
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

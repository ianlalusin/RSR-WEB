'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/providers/auth-provider';
import { addRequest } from '@/app/actions';
import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

const SECTOR_OPTIONS = [
  { value: 'medical', label: 'Medical' },
  { value: 'educational', label: 'Educational' },
  { value: 'infrastructure', label: 'Infrastructure' },
];

const SUB_CATEGORIES: Record<string, { value: string; label: string }[]> = {
  medical: [
    { value: 'medical_assistance', label: 'Medical Assistance' },
    { value: 'accredited_hospitals', label: 'Accredited Hospitals' },
    { value: 'financial_standing', label: 'Financial Standing' },
  ],
  educational: [
    { value: 'ched_tulong_dunong', label: 'CHED Tulong Dunong' },
    { value: 'cong_scholarship', label: 'Cong Scholarship' },
  ],
  infrastructure: [],
};

const formSchema = z.object({
  districtId: z.string().min(1, 'District is required'),
  brgyId: z.string().min(1, 'Barangay is required'),
  proponents: z.string().min(1, 'Proponents is required'),
  resoTitle: z.string().min(1, 'Reso title is required'),
  resoNumber: z.string().optional(),
  description: z.string().optional(),
  dateReceived: z.string().min(1, 'Date received is required'),
  dateFiled: z.string().min(1, 'Date filed is required'),
  sector: z.enum(['medical', 'educational', 'infrastructure']),
  subCategory: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BarangayOption {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
}

export default function RequestFormDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      districtId: '',
      brgyId: '',
      proponents: '',
      resoTitle: '',
      resoNumber: '',
      description: '',
      dateReceived: new Date().toISOString().split('T')[0],
      dateFiled: '',
      sector: 'medical',
      subCategory: '',
    },
  });

  const selectedSector = form.watch('sector');
  const selectedDistrict = form.watch('districtId');

  useEffect(() => {
    if (!isOpen) return;
    const fetchBarangays = async () => {
      const q = query(collection(db, 'barangays'));
      const snap = await getDocs(q);
      const items: BarangayOption[] = [];
      const districtMap = new Map<string, string>();
      snap.forEach((doc) => {
        const d = doc.data();
        items.push({ id: doc.id, name: d.name, districtId: d.districtId, districtName: d.districtName });
        if (d.districtId && d.districtName) districtMap.set(d.districtId, d.districtName);
      });
      setBarangays(items.sort((a, b) => a.name.localeCompare(b.name)));
      setDistricts(Array.from(districtMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
    };
    fetchBarangays();
  }, [isOpen]);

  const filteredBarangays = selectedDistrict
    ? barangays.filter((b) => b.districtId === selectedDistrict)
    : barangays;

  const onSubmit = async (values: FormValues) => {
    if (!user) return;

    const selectedBrgy = barangays.find((b) => b.id === values.brgyId);
    const selectedDist = districts.find((d) => d.id === values.districtId);

    const result = await addRequest(
      {
        districtId: values.districtId,
        districtName: selectedDist?.name || '',
        brgyId: values.brgyId,
        brgyName: selectedBrgy?.name || '',
        proponents: values.proponents,
        resoTitle: values.resoTitle,
        resoNumber: values.resoNumber,
        description: values.description,
        dateReceived: Timestamp.fromDate(new Date(values.dateReceived)),
        dateFiled: Timestamp.fromDate(new Date(values.dateFiled)),
        sector: values.sector,
        subCategory: values.subCategory || undefined,
      },
      await user!.getIdToken()
    );

    if (result.success) {
      toast({ title: 'Request Created', description: 'The request has been encoded successfully.' });
      form.reset();
      setIsOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Request</DialogTitle>
          <DialogDescription>Encode a new incoming request or resolution.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="districtId" render={({ field }) => (
                <FormItem>
                  <FormLabel>District</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); form.setValue('brgyId', ''); }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {districts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="brgyId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Barangay</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedDistrict}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select barangay" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {filteredBarangays.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="proponents" render={({ field }) => (
              <FormItem>
                <FormLabel>Proponents</FormLabel>
                <FormControl><Input placeholder="Name of proponents" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="resoTitle" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Title</FormLabel>
                  <FormControl><Input placeholder="Reso title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="resoNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Number (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g. Reso-2026-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="dateReceived" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Received</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateFiled" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Filed</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="sector" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <Select onValueChange={(v) => { field.onChange(v); form.setValue('subCategory', ''); }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {SECTOR_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {SUB_CATEGORIES[selectedSector]?.length > 0 && (
                <FormField control={form.control} name="subCategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SUB_CATEGORIES[selectedSector].map((sc) => <SelectItem key={sc.value} value={sc.value}>{sc.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl><Textarea placeholder="Additional details..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

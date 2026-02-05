'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, getDoc, collection, getDocs, query, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import type { MedicalRecord, MedicalProjectType, MedicalAssistanceType, BarangayListItem, BarangayListDoc, Hospital, HospitalListDoc, UserProfile, Role, RoleListDoc } from '@/lib/types';
import { Loader2, CalendarIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  projectType: z.enum(['medical_drive', 'medical_assistance']),
  
  // Medical Drive fields
  title: z.string().optional(),
  description: z.string().optional(),
  beneficiaryCount: z.coerce.number().optional(),
  
  // Medical Assistance fields
  fullName: z.string().optional(),
  contact: z.string().optional(),
  address: z.string().optional(),
  birthday: z.string().optional(),
  householdSize: z.coerce.number().optional(),
  hospital: z.string().optional(),
  assistanceType: z.enum(['operation', 'checkup', 'dental', 'medicine', 'other']).optional(),
  
  // Location
  districtId: z.string().min(1, "District is required"),
  districtName: z.string().min(1, "District is required"),
  brgyId: z.string().min(1, "Barangay is required"),
  brgyName: z.string().min(1, "Barangay is required"),

  eventDate: z.string().min(1, "Event date is required"),
  
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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isEditMode = !!record;

  const [districts, setDistricts] = useState<{id: string, name: string}[]>([]);
  const [barangays, setBarangays] = useState<(BarangayListItem & {id: string})[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [coordinators, setCoordinators] = useState<UserProfile[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectType: 'medical_assistance',
      fullName: record?.fullName || '',
      contact: record?.contact || '',
      address: record?.address || '',
      birthday: record?.birthday || '',
      householdSize: record?.householdSize || 0,
      hospital: record?.hospital || '',
      coordinatorId: record?.referralDetails?.coordinatorId || '',
      coordinatorName: record?.referralDetails?.coordinatorName || '',
    },
  });

  useEffect(() => {
    if (record) {
      const toInputDate = (date: any): string => {
        if (!date) return '';
        const jsDate = date.toDate ? date.toDate() : new Date(date);
        if (isNaN(jsDate.getTime())) {
          return '';
        }
        return jsDate.toISOString().split('T')[0];
      };

      form.reset({
        ...record,
        eventDate: toInputDate(record.eventDate),
        dateReferred: toInputDate(record.referralDetails?.dateReferred),
        dateApproved: toInputDate(record.referralDetails?.dateApproved),
        birthday: toInputDate(record.birthday),
        contact: record.contact || '',
        address: record.address || '',
        householdSize: record.householdSize || 0,
        title: record.title || '',
        description: record.description || '',
        beneficiaryCount: record.beneficiaryCount || 0,
        fullName: record.fullName || '',
        hospital: record.hospital || '',
        coordinatorId: record.referralDetails?.coordinatorId || '',
        coordinatorName: record.referralDetails?.coordinatorName || '',
      });
    }
  }, [record, form]);

  useEffect(() => {
    if (isOpen) {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Barangays and derive Districts
                const brgyListRef = doc(db, 'lists', 'barangays');
                const brgySnap = await getDoc(brgyListRef);
                if (brgySnap.exists()) {
                    const listData = brgySnap.data() as BarangayListDoc;
                    const brgys = Object.entries(listData.barangays || {}).map(([id, data]) => ({ id, ...data }));
                    setBarangays(brgys);
                    const uniqueDistricts = Object.values(brgys.reduce((acc, brgy) => {
                        if (!acc[brgy.districtId]) {
                            acc[brgy.districtId] = { id: brgy.districtId, name: brgy.districtName };
                        }
                        return acc;
                    }, {} as Record<string, {id: string, name: string}>));
                    setDistricts(uniqueDistricts.sort((a,b) => a.name.localeCompare(b.name)));
                }

                // Fetch Hospitals
                const hospitalListRef = doc(db, 'lists', 'hospitals');
                const hospitalSnap = await getDoc(hospitalListRef);
                if (hospitalSnap.exists()) {
                    const listData = hospitalSnap.data() as HospitalListDoc;
                    const hospitalList = Object.entries(listData.hospitals || {}).map(([id, data]) => ({ id, ...data } as Hospital));
                    setHospitals(hospitalList.sort((a,b) => a.name.localeCompare(b.name)));
                } else {
                    await setDoc(hospitalListRef, { hospitals: {} });
                }

                // Fetch Coordinators
                const rolesListRef = doc(db, 'lists', 'roles');
                const rolesSnap = await getDoc(rolesListRef);
                let coordinatorRoleId: string | undefined;
                if(rolesSnap.exists()){
                    const rolesData = rolesSnap.data() as RoleListDoc;
                    coordinatorRoleId = Object.entries(rolesData.roles || {}).find(([,data]) => data.name.toLowerCase() === 'coordinator')?.[0];
                }

                if(coordinatorRoleId) {
                    const usersQuery = query(collection(db, 'users'));
                    const usersSnap = await getDocs(usersQuery);
                    const allUsers = usersSnap.docs.map(d => d.data() as UserProfile);
                    const coordinatorUsers = allUsers.filter(u => u.roleId === coordinatorRoleId && u.isActive);
                    setCoordinators(coordinatorUsers);
                }

            } catch (error) {
                console.error("Failed to fetch form data", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load necessary data.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }
  }, [isOpen, toast]);

  const projectType = form.watch('projectType');
  const selectedDistrictId = form.watch('districtId');

  const filteredBarangays = useMemo(() => {
    if (!selectedDistrictId) return [];
    return barangays.filter(b => b.districtId === selectedDistrictId).sort((a,b) => a.name.localeCompare(b.name));
  }, [selectedDistrictId, barangays]);
  
  const filteredCoordinators = useMemo(() => {
    if(!selectedDistrictId) return [];
    return coordinators.filter(c => c.access?.districtIds?.includes(selectedDistrictId));
  }, [selectedDistrictId, coordinators]);

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error' });
        return;
    }
    const actor = { uid: userProfile.uid, email: userProfile.email };
    
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
      <DialogContent className="max-w-3xl">
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
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4" >
                                {PROJECT_TYPES.map(type => (
                                    <FormItem key={type.value} className="flex items-center space-x-2">
                                        <FormControl><RadioGroupItem value={type.value} /></FormControl>
                                        <FormLabel className="font-normal">{type.label}</FormLabel>
                                    </FormItem>
                                ))}
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />

                {projectType === 'medical_drive' ? (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Drive Title</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="beneficiaryCount" render={({ field }) => ( <FormItem><FormLabel>Beneficiary Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                ) : (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <h3 className="font-semibold text-md">Beneficiary Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="contact" render={({ field }) => ( <FormItem><FormLabel>Contact</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                         <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="birthday" render={({ field }) => ( <FormItem><FormLabel>Birthday</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="householdSize" render={({ field }) => ( <FormItem><FormLabel>Household Size</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                )}
                
                <div className='space-y-4 p-4 border rounded-lg'>
                    <h3 className="font-semibold text-md">Location & Date</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="districtId" render={({ field }) => ( <FormItem><FormLabel>District</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                const district = districts.find(d => d.id === value);
                                form.setValue('districtName', district?.name || '');
                                form.setValue('brgyId', '');
                                form.setValue('brgyName', '');
                            }} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                                <SelectContent>{districts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                            </Select>
                        <FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="brgyId" render={({ field }) => ( <FormItem><FormLabel>Barangay</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                const brgy = filteredBarangays.find(b => b.id === value);
                                form.setValue('brgyName', brgy?.name || '');
                            }} defaultValue={field.value} disabled={!selectedDistrictId}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a barangay" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredBarangays.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                            </Select>
                        <FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="eventDate" render={({ field }) => ( <FormItem><FormLabel>Event Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                
                 {projectType === 'medical_assistance' && (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <h3 className="font-semibold text-md">Assistance Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="hospital" render={({ field }) => ( <FormItem><FormLabel>Hospital</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a hospital" /></SelectTrigger></FormControl>
                                    <SelectContent>{hospitals.map(h => <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="assistanceType" render={({ field }) => ( <FormItem><FormLabel>Assistance Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                                    <SelectContent>{ASSISTANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                </Select>
                            <FormMessage /></FormItem> )} />
                        </div>
                    </div>
                 )}
                 
                 {projectType === 'medical_assistance' && (
                    <div className='space-y-4 p-4 border rounded-lg animate-in fade-in'>
                        <h3 className="font-semibold text-md">Referral Details</h3>
                        <FormField control={form.control} name="coordinatorId" render={({ field }) => ( <FormItem><FormLabel>Coordinator</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value);
                                const coordinator = filteredCoordinators.find(c => c.uid === value);
                                form.setValue('coordinatorName', coordinator?.displayName || '');
                            }} defaultValue={field.value} disabled={!selectedDistrictId}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a coordinator" /></SelectTrigger></FormControl>
                                <SelectContent>{filteredCoordinators.map(c => <SelectItem key={c.uid} value={c.uid}>{c.displayName}</SelectItem>)}</SelectContent>
                            </Select>
                        <FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="dateReferred" render={({ field }) => ( <FormItem><FormLabel>Date Referred</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="dateApproved" render={({ field }) => ( <FormItem><FormLabel>Date Approved</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    </div>
                 )}

              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || isLoading}>
                {(form.formState.isSubmitting || isLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Record'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

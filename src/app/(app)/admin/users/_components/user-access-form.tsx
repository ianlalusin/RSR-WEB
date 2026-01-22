'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { updateUserAccess } from '@/app/actions';
import {
  UserProfile,
  Department,
  Position,
  PageKey,
  AccessLevel,
} from '@/lib/types';
import { ALL_PAGE_KEYS } from '@/lib/access';
import { Loader2 } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  isActive: z.boolean(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  access: z.object({
    districtIds: z.array(z.string()).default([]),
    pages: z.record(z.string(), z.object({ level: z.string() })),
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  user: UserProfile;
  actor: UserProfile;
  onSuccess?: () => void;
}

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  barangays_list: 'Barangays (List)',
  barangay_detail: 'Barangay (Detail)',
  organization_orgMembers: 'Organization - Members',
  organization_departments: 'Organization - Departments',
  organization_positions: 'Organization - Positions',
  assistance_projects: 'Assistance Projects',
  analytics: 'Analytics',
  profile: 'User Profile',
  admin_users: 'Admin - User Management',
};

export default function UserAccessForm({ user, actor, onSuccess }: Props) {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isActive: user.isActive,
      departmentId: user.departmentId || '',
      positionId: user.positionId || '',
      access: {
        districtIds: user.access?.districtIds || [],
        pages: (ALL_PAGE_KEYS.reduce((acc, key) => {
          acc[key] = { level: user.access?.pages?.[key]?.level || 'restricted' };
          return acc;
        }, {} as Record<PageKey, { level: AccessLevel }>)),
      },
    },
  });

  useEffect(() => {
    // Fetch departments, positions, and districts
    const unsubDepartments = onSnapshot(
      collection(db, 'departments'),
      (snap) =>
        setDepartments(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department))
        )
    );
    const unsubPositions = onSnapshot(collection(db, 'positions'), (snap) =>
      setPositions(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Position))
      )
    );
    
    const fetchDistricts = async () => {
        const q = query(collection(db, 'barangays'));
        const querySnapshot = await getDocs(q);
        const uniqueDistricts = new Map<string, string>();
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if(data.districtId && data.districtName) {
                uniqueDistricts.set(data.districtId, data.districtName);
            }
        });
        setDistricts(Array.from(uniqueDistricts, ([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name)));
    };
    fetchDistricts();

    return () => {
      unsubDepartments();
      unsubPositions();
    };
  }, []);
  
  const onSubmit = async (values: FormValues) => {
    const originalData: Partial<UserProfile> = {
      isActive: user.isActive,
      departmentId: user.departmentId,
      positionId: user.positionId,
      access: user.access
    };
    const payload: Partial<UserProfile> = {
        isActive: values.isActive,
        departmentId: values.departmentId,
        positionId: values.positionId,
        access: {
            districtIds: values.access.districtIds,
            pages: values.access.pages as Record<PageKey, {level: AccessLevel}>
        }
    }
    
    try {
      const result = await updateUserAccess(user.uid, payload, actor, originalData);
      if (result.success) {
        toast({
          title: `User updated`,
          description: `${user.displayName}'s profile has been successfully updated.`,
        });
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-1">
                <div className="space-y-0.5">
                    <FormLabel>Active Status</FormLabel>
                </div>
                <FormControl>
                    <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    />
                </FormControl>
                </FormItem>
            )}
            />
            <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                <FormItem className="col-span-1">
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                    </Select>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="positionId"
                render={({ field }) => (
                <FormItem className="col-span-1">
                    <FormLabel>Position</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a position" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                    </Select>
                </FormItem>
                )}
            />
        </div>

        <Separator />

        <FormField
          control={form.control}
          name="access.districtIds"
          render={() => (
            <FormItem>
              <FormLabel className="text-base font-semibold">District Scope</FormLabel>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                {districts.map((d) => (
                  <FormField
                    key={d.id}
                    control={form.control}
                    name="access.districtIds"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={d.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(d.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...field.value, d.id])
                                  : field.onChange(
                                      field.value?.filter(
                                        (value) => value !== d.id
                                      )
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {d.name}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Separator />

        <div>
            <FormLabel className="text-base font-semibold">Page Permissions</FormLabel>
            <Table className="mt-2">
                <TableHeader>
                    <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead>Access Level</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ALL_PAGE_KEYS.map((key) => (
                        <TableRow key={key}>
                            <TableCell>{PAGE_LABELS[key]}</TableCell>
                            <TableCell>
                                <FormField
                                    control={form.control}
                                    name={`access.pages.${key}.level`}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Set access level" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="restricted">Restricted</SelectItem>
                                                <SelectItem value="readonly">Read-Only</SelectItem>
                                                <SelectItem value="readwrite">Read & Write</SelectItem>
                                                <SelectItem value="full">Full Access</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>


        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}

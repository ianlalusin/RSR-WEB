'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Loader2, ChevronsUpDown, Edit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  departments: Department[];
  positions: Position[];
  districts: { id: string; name: string }[];
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

const ACCESS_LEVELS: AccessLevel[] = ['restricted', 'readonly', 'readwrite', 'full'];

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <div className="text-base mt-1">{children}</div>
    </div>
);


export default function UserAccessRow({ user, actor, departments, positions, districts, onSuccess }: Props) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

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
    if (!isOpen) {
        setIsEditMode(false);
    }
  }, [isOpen]);

  useEffect(() => {
      if (isOpen && !isEditMode) {
          form.reset({
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
          })
      }
  }, [isOpen, isEditMode, user, form]);
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0,2).toUpperCase();
  };

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
        setIsEditMode(false);
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

  const userPosition = positions.find(p => p.id === user.positionId);
  const userDepartment = departments.find(d => d.id === user.departmentId);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-4">
            <Avatar>
                <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            <div className='flex flex-col items-start'>
                <span className="font-medium">{user.displayName}</span>
                <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
              {userDepartment && <Badge variant="secondary">{userDepartment.name}</Badge>}
              {userPosition && <Badge variant="outline">{userPosition.name}</Badge>}
              <Badge variant={user.isActive ? 'default' : 'secondary'} className={cn('border-transparent', user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 pt-0">
            <Separator className="mb-6" />
            <h3 className="text-xl font-semibold mb-4">{user.displayName}</h3>
            {isEditMode ? (
                <ScrollArea className="max-h-[60vh]">
                  <div className="pr-4">
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
                                        <TableHead className="text-right">Access Level</TableHead>
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
                                                        <RadioGroup
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                            className="flex justify-end space-x-4"
                                                        >
                                                            {ACCESS_LEVELS.map(level => (
                                                                <FormItem key={level} className="flex items-center space-x-2 space-y-0">
                                                                    <FormControl>
                                                                        <RadioGroupItem value={level} id={`${user.uid}-${key}-${level}`} />
                                                                    </FormControl>
                                                                    <FormLabel htmlFor={`${user.uid}-${key}-${level}`} className="font-normal capitalize">{level}</FormLabel>
                                                                </FormItem>
                                                            ))}
                                                        </RadioGroup>
                                                    )}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsEditMode(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                    </Form>
                    </div>
                </ScrollArea>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <DetailItem label="Active Status">
                            <Badge variant={user.isActive ? 'default' : 'secondary'} className={cn('border-transparent', user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
                        </DetailItem>
                        <DetailItem label="Department">
                            <p>{userDepartment?.name || 'N/A'}</p>
                        </DetailItem>
                        <DetailItem label="Position">
                            <p>{userPosition?.name || 'N/A'}</p>
                        </DetailItem>
                    </div>

                    <Separator />

                    <DetailItem label="District Scope">
                        {(user.access?.districtIds?.length || 0) > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-1">
                                {user.access.districtIds.map(id => {
                                    const district = districts.find(d => d.id === id);
                                    return district ? <Badge key={id} variant="secondary">{district.name}</Badge> : null;
                                })}
                            </div>
                        ) : <p className="text-muted-foreground">No districts assigned.</p>}
                    </DetailItem>
                    
                    <Separator />

                    <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Page Permissions</p>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Page</TableHead>
                                    <TableHead className="text-right">Access Level</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ALL_PAGE_KEYS.map((key) => (
                                    <TableRow key={key}>
                                        <TableCell>{PAGE_LABELS[key]}</TableCell>
                                        <TableCell className="text-right capitalize">
                                            {user.access?.pages?.[key]?.level || 'restricted'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setIsEditMode(true)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Access
                        </Button>
                    </div>
                </div>
            )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

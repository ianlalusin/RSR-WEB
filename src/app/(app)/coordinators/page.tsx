'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Coordinator, Department, UserProfile, PermissionKey, DepartmentScope } from '@/lib/types';
import { DataTable } from './data-table';
import { columns as coordinatorsColumns } from './columns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { canManageDepartments } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Edit, Loader2 } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addDepartment, updateDepartment, deleteDepartment } from '@/app/actions';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { mockCoordinators } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const ALL_SCOPES: { id: DepartmentScope, label: string }[] = [
    { id: 'department', label: 'Department' },
    { id: 'district', label: 'District' },
    { id: 'brgy', label: 'Barangay' },
];

const PERMISSION_CONFIG: Record<PermissionKey, { label: string }> = {
  barangays: { label: 'Barangays' },
  barangayCaptain: { label: 'Barangay Captain Profile' },
  coordinators: { label: 'Coordinators' },
  projects: { label: 'RSR Projects' },
  users: { label: 'User Management' },
};
const PERMISSION_KEYS = Object.keys(PERMISSION_CONFIG) as PermissionKey[];


// --- Department Form ---
const departmentFormSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  description: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  permissions: z.record(z.string(), z.object({
    read: z.boolean().default(false),
    add: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
  })).default({}),
});

type DepartmentFormValues = z.infer<typeof departmentFormSchema>;

function DepartmentFormDialog({
  department,
  children,
  onSuccess,
}: {
  department?: Department;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isEditMode = !!department;

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: isEditMode ? {
        name: department.name,
        description: department.description || '',
        scopes: department.scopes || [],
        permissions: department.permissions || {},
    } : {
        name: '',
        description: '',
        scopes: [],
        permissions: {},
    },
  });
  
  useEffect(() => {
    if (isOpen) {
      if (department) {
        form.reset({
          name: department.name,
          description: department.description || '',
          scopes: department.scopes || [],
          permissions: department.permissions || {},
        });
      } else {
        form.reset({
          name: '',
          description: '',
          scopes: [],
          permissions: {},
        });
      }
    }
  }, [isOpen, department, form]);

  const onSubmit = async (values: DepartmentFormValues) => {
    if (!userProfile) return;
    const actor = { uid: userProfile.uid, email: userProfile.email };
    try {
      const result = isEditMode
        ? await updateDepartment(department.id, values, actor)
        : await addDepartment(values, actor);

      if (result.success) {
        toast({
          title: `Department ${isEditMode ? 'updated' : 'added'}`,
          description: `${values.name} has been successfully ${isEditMode ? 'updated' : 'saved'}.`,
        });
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

  const handleAllPermissionChange = (key: PermissionKey, checked: boolean) => {
    form.setValue(`permissions.${key}.read`, checked);
    form.setValue(`permissions.${key}.add`, checked);
    form.setValue(`permissions.${key}.edit`, checked);
    form.setValue(`permissions.${key}.delete`, checked);
  };

  const watchedPermissions = form.watch('permissions');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Department' : 'Add New Department'}</DialogTitle>
           <DialogDescription>
            Configure department details, data access scope, and page permissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6 p-4">
                {/* Basic Details */}
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Name</FormLabel> <FormControl><Input placeholder="e.g., Finance" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea placeholder="What does this department do?" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                
                <Separator />

                {/* Data Access Scope */}
                <FormField
                    control={form.control}
                    name="scopes"
                    render={() => (
                        <FormItem>
                            <FormLabel className="text-base font-semibold">Data Access Scope</FormLabel>
                            <FormMessage />
                            <div className="flex flex-row items-center space-x-4 pt-2">
                            {ALL_SCOPES.map((scope) => (
                                <FormField
                                key={scope.id}
                                control={form.control}
                                name="scopes"
                                render={({ field }) => (
                                    <FormItem key={scope.id} className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(scope.id)}
                                                onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...field.value, scope.id])
                                                    : field.onChange(field.value?.filter((value) => value !== scope.id))
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal">{scope.label}</FormLabel>
                                    </FormItem>
                                )}
                                />
                            ))}
                            </div>
                        </FormItem>
                    )}
                />

                <Separator />
                
                {/* Permissions Matrix */}
                <div className='space-y-2'>
                    <FormLabel className="text-base font-semibold">Page & Data Permissions</FormLabel>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Page / Data</TableHead>
                                <TableHead className="text-center">Read</TableHead>
                                <TableHead className="text-center">Add</TableHead>
                                <TableHead className="text-center">Edit</TableHead>
                                <TableHead className="text-center">Delete</TableHead>
                                <TableHead className="text-center">All</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {PERMISSION_KEYS.map((key) => {
                                const currentPerms = watchedPermissions?.[key] || {};
                                const allChecked = currentPerms.read && currentPerms.add && currentPerms.edit && currentPerms.delete;
                                return (
                                    <TableRow key={key}>
                                        <TableCell className="font-medium">{PERMISSION_CONFIG[key].label}</TableCell>
                                        {(['read', 'add', 'edit', 'delete'] as const).map((action) => (
                                            <TableCell key={action} className="text-center">
                                                <Controller
                                                    name={`permissions.${key}.${action}`}
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                    )}
                                                />
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={allChecked}
                                                onCheckedChange={(checked) => handleAllPermissionChange(key, !!checked)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


// --- Delete Department Alert ---
function DeleteDepartmentAlert({ department, children, onSuccess }: { department: Department; children: React.ReactNode; onSuccess?: () => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const handleDelete = async () => {
    if (!userProfile) return;
    const actor = { uid: userProfile.uid, email: userProfile.email };
    setIsDeleting(true);
    try {
      const result = await deleteDepartment(department.id, actor);
      if (result.success) {
        toast({ title: 'Department Deleted', description: `${department.name} has been deleted.` });
        setIsOpen(false);
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action will permanently delete the <strong>{department.name}</strong> department.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


// --- Departments Tab ---
function DepartmentsTab() {
  const { userProfile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = canManageDepartments(userProfile);

  useEffect(() => {
    const q = query(collection(db, 'departments'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data: Department[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      setDepartments(data);
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch departments:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const departmentColumns: ColumnDef<Department>[] = [
    { accessorKey: 'name', header: 'Name' },
    { 
        accessorKey: 'scopes', 
        header: 'Scopes',
        cell: ({ row }) => {
            const scopes: DepartmentScope[] = row.getValue('scopes') || [];
            if (scopes.length === 0) return <span className="text-muted-foreground text-xs">Not set</span>
            return (
                <div className='flex flex-wrap gap-1'>
                    {scopes.map(scope => <Badge key={scope} variant="secondary" className="capitalize">{scope}</Badge>)}
                </div>
            )
        }
    },
    { accessorKey: 'description', header: 'Description', cell: ({row}) => <p className='line-clamp-2 text-muted-foreground text-xs'>{row.original.description || 'N/A'}</p> },
    {
      id: 'actions',
      cell: ({ row }) => {
        const department = row.original;
        if (!canManage) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DepartmentFormDialog department={department}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
              </DepartmentFormDialog>
              <DropdownMenuSeparator />
               <DeleteDepartmentAlert department={department}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              </DeleteDepartmentAlert>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading) {
    return (
        <div className="space-y-4 pt-4">
            <div className="flex justify-end">
                <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-48 w-full" />
        </div>
    )
  }

  return (
    <div>
        <div className="flex justify-end py-4">
            {canManage && (
            <DepartmentFormDialog>
                <Button><PlusCircle className="mr-2 h-4 w-4" />Add Department</Button>
            </DepartmentFormDialog>
            )}
        </div>
        <DataTable columns={departmentColumns} data={departments} />
    </div>
  );
}

// --- Coordinators Tab ---
function CoordinatorsTab() {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);

  // NOTE: This uses mock data. In a real app, you would fetch from Firestore.
  useEffect(() => {
    setCoordinators(mockCoordinators);
    setLoading(false);
  }, []);
  
  if (loading) {
    return (
        <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-48 w-full" />
        </div>
    )
  }

  return <DataTable columns={coordinatorsColumns} data={coordinators} />;
}

// --- Main Page Component ---
export default function OrganizationPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>
          Manage coordinators and departments within the organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="coordinators" className="w-full">
          <TabsList>
            <TabsTrigger value="coordinators">Coordinators</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>
          <TabsContent value="coordinators">
            <CoordinatorsTab />
          </TabsContent>
          <TabsContent value="departments">
            <DepartmentsTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

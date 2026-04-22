'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Department, Role, UserProfile, DepartmentListDoc, RoleListDoc } from '@/lib/types';
import { DataTable } from './data-table';
import { getOrgMemberColumns } from './columns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, canDo } from '@/lib/access';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Edit, Loader2, AlertTriangle } from 'lucide-react';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addDepartment, updateDepartment, deleteDepartment, addRole, updateRole, deleteRole } from '@/app/actions';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ALL_PAGE_KEYS } from '@/lib/access';
import type { AccessLevel, PageKey } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import DepartmentEditDialog from './_components/department-edit-dialog';


// --- Department Form ---
const departmentFormSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  description: z.string().optional(),
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
  const { user, userProfile } = useAuth();
  const isEditMode = !!department;

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: isEditMode ? {
        name: department.name,
        description: department.description || '',
    } : {
        name: '',
        description: '',
    },
  });
  
  useEffect(() => {
    if (isOpen) {
        form.reset(isEditMode ? { name: department.name, description: department.description || '' } : { name: '', description: '' });
    }
  }, [isOpen, department, form, isEditMode]);

  const onSubmit = async (values: DepartmentFormValues) => {
    if (!userProfile) return;
    const actorToken = await user!.getIdToken();
    try {
      const result = isEditMode
        ? await updateDepartment(department.id, values, actorToken)
        : await addDepartment(values, actorToken);

      if (result.success) {
        toast({
          title: `Department ${isEditMode ? 'updated' : 'added'}`,
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Department' : 'Add New Department'}</DialogTitle>
           <DialogDescription>
            Departments are for organizational grouping only. Permissions are managed per-user in User Access Management.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Name</FormLabel> <FormControl><Input placeholder="e.g., Finance" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea placeholder="What does this department do?" {...field} /></FormControl> <FormMessage /> </FormItem> )} />
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
  const { user, userProfile } = useAuth();

  const handleDelete = async () => {
    if (!userProfile) return;
    const actorToken = await user!.getIdToken();
    setIsDeleting(true);
    try {
      const result = await deleteDepartment(department.id, actorToken);
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
function DepartmentsTab({ departments, loading, canWrite, canDel }: { departments: Department[], loading: boolean, canWrite: boolean, canDel: boolean }) {
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const departmentColumns: ColumnDef<Department>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'description', header: 'Description', cell: ({row}) => <p className='line-clamp-2 text-muted-foreground text-xs'>{row.original.description || 'N/A'}</p> },
    {
      id: 'actions',
      cell: ({ row }) => {
        const department = row.original;
        if (!canWrite) return null;
        return (
          <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setEditingDepartment(department)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
              {canDel && <>
                <DropdownMenuSeparator />
                <DeleteDepartmentAlert department={department}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />Delete
                    </DropdownMenuItem>
                </DeleteDepartmentAlert>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
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

  const handleRowClick = (department: Department) => {
    if (canWrite) {
      setEditingDepartment(department);
    }
  };

  return (
    <div>
        <div className="flex justify-end py-4">
            {canWrite && (
            <DepartmentFormDialog>
                <Button><PlusCircle className="mr-2 h-4 w-4" />Add Department</Button>
            </DepartmentFormDialog>
            )}
        </div>
        <DataTable columns={departmentColumns} data={departments} filterColumnId="name" filterPlaceholder="Filter departments..." onRowClick={handleRowClick} />
        {canWrite && <DepartmentEditDialog department={editingDepartment} isOpen={!!editingDepartment} onOpenChange={() => setEditingDepartment(null)} />}
    </div>
  );
}

// --- Role Form ---
const ACCESS_LEVELS: [AccessLevel, ...AccessLevel[]] = ['restricted', 'readonly', 'readwrite', 'full'];

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard', barangays_list: 'Barangays (List)', barangay_detail: 'Barangay (Detail)',
  organization_orgMembers: 'Org - Members', organization_departments: 'Org - Departments', organization_roles: 'Org - Roles',
  receiving: 'Receiving', projects_medical: 'Medical', projects_hospitals: 'Hospitals',
  projects_educational: 'Educational', projects_infrastructure: 'Infrastructure',
  tasker: 'Tasker', analytics: 'Analytics', profile: 'Profile',
  admin_users: 'Admin - Users', socmed: 'SocMed',
  scholarship_providers: 'Scholarship - Providers',
  scholarship_applications: 'Scholarship - Applications',
  scholarship_scholars: 'Scholarship - Scholars',
  scholarship_portal: 'Scholarship - Portal',
};

const roleFormSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  rank: z.coerce.number().int().min(1, 'Min 1').max(99, 'Max 99'),
  scopeBreadth: z.enum(['own_districts', 'all_districts', 'none']),
  preset: z.record(z.enum(ACCESS_LEVELS)).optional(),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

function RoleFormDialog({
  role,
  children,
  onSuccess,
}: {
  role?: Role;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const isEditMode = !!role;
  const isBuiltIn = role?.isBuiltIn ?? false;

  const defaultPreset = ALL_PAGE_KEYS.reduce((acc, k) => { acc[k] = 'restricted'; return acc; }, {} as Record<string, AccessLevel>);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: '', rank: 20, scopeBreadth: 'own_districts', preset: defaultPreset },
  });

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && role) {
        const preset = ALL_PAGE_KEYS.reduce((acc, k) => {
          acc[k] = (role.preset?.[k] as AccessLevel) ?? 'restricted';
          return acc;
        }, {} as Record<string, AccessLevel>);
        form.reset({ name: role.name, rank: role.rank ?? 20, scopeBreadth: role.scopeBreadth ?? 'own_districts', preset });
      } else {
        form.reset({ name: '', rank: 20, scopeBreadth: 'own_districts', preset: defaultPreset });
      }
    }
  }, [isOpen, role, form, isEditMode]);

  const onSubmit = async (values: RoleFormValues) => {
    if (!userProfile) return;
    const actorToken = await user!.getIdToken();
    try {
      const result = isEditMode
        ? await updateRole(role.id, values, actorToken)
        : await addRole({ name: values.name }, actorToken);

      if (result.success) {
        toast({ title: `Role ${isEditMode ? 'updated' : 'added'}` });
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{isEditMode ? 'Edit Role' : 'Add New Role'}</DialogTitle>
            {isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
          </div>
          <DialogDescription>
            {isBuiltIn
              ? 'Built-in role — name and preset are editable; rank and scope are fixed.'
              : 'Custom role — all fields are editable. Rank determines management hierarchy (higher outranks lower).'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-1">
                  <FormLabel>Role Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Field Coordinator" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rank" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rank</FormLabel>
                  <FormControl><Input type="number" min={1} max={99} disabled={isBuiltIn} {...field} /></FormControl>
                  <FormDescription className="text-xs">1–99. Higher outranks lower.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scopeBreadth" render={({ field }) => (
                <FormItem>
                  <FormLabel>District Scope</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isBuiltIn}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="own_districts">Own districts only</SelectItem>
                      <SelectItem value="all_districts">All districts</SelectItem>
                      <SelectItem value="none">None (e.g. applicant)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div>
              <p className="text-sm font-semibold mb-1">Default Preset <span className="font-normal text-muted-foreground">(applied when role is assigned to a user)</span></p>
              <ScrollArea className="h-56 rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Page</TableHead>
                      {ACCESS_LEVELS.map(l => <TableHead key={l} className="text-center capitalize text-xs">{l}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_PAGE_KEYS.map(pageKey => (
                      <FormField key={pageKey} control={form.control} name={`preset.${pageKey}` as any} render={({ field }) => (
                        <TableRow>
                          <TableCell className="text-xs font-medium py-1">{PAGE_LABELS[pageKey]}</TableCell>
                          <TableCell colSpan={4} className="py-1">
                            <RadioGroup onValueChange={field.onChange} value={field.value as string} className="flex gap-0">
                              {ACCESS_LEVELS.map(level => (
                                <div key={level} className="flex flex-1 items-center justify-center">
                                  <RadioGroupItem value={level} id={`${pageKey}-${level}`} className="h-3 w-3" />
                                </div>
                              ))}
                            </RadioGroup>
                          </TableCell>
                        </TableRow>
                      )} />
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            <DialogFooter className="pt-2">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Delete Role Alert ---
function DeleteRoleAlert({ role, children, onSuccess }: { role: Role; children: React.ReactNode; onSuccess?: () => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const handleDelete = async () => {
    if (!userProfile) return;
    const actorToken = await user!.getIdToken();
    setIsDeleting(true);
    try {
      const result = await deleteRole(role.id, actorToken);
      if (result.success) {
        toast({ title: 'Role Deleted' });
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
          <AlertDialogDescription>This will permanently delete the <strong>{role.name}</strong> role.</AlertDialogDescription>
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

const SCOPE_LABELS: Record<string, string> = {
  own_districts: 'Own districts',
  all_districts: 'All districts',
  none: 'None',
};

// --- Roles Tab ---
function RolesTab({ roles, loading, canWrite, canDel }: { roles: Role[], loading: boolean, canWrite: boolean, canDel: boolean }) {
  const roleColumns: ColumnDef<Role>[] = [
    {
      accessorKey: 'name',
      header: 'Role',
      cell: ({ row }) => {
        const role = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{role.name}</span>
            {role.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
          </div>
        );
      },
    },
    {
      accessorKey: 'rank',
      header: 'Rank',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.rank}</span>,
    },
    {
      accessorKey: 'scopeBreadth',
      header: 'District Scope',
      cell: ({ row }) => <span className="text-sm">{SCOPE_LABELS[row.original.scopeBreadth] ?? row.original.scopeBreadth}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const role = row.original;
        if (!canWrite) return null;
        return (
          <div className="text-right">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <RoleFormDialog role={role}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                </RoleFormDialog>
                {canDel && !role.isBuiltIn && <>
                    <DropdownMenuSeparator />
                    <DeleteRoleAlert role={role}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                    </DeleteRoleAlert>
                </>}
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            {canWrite && (
            <RoleFormDialog>
                <Button><PlusCircle className="mr-2 h-4 w-4" />Add Role</Button>
            </RoleFormDialog>
            )}
        </div>
        <DataTable columns={roleColumns} data={roles} filterColumnId="name" filterPlaceholder="Filter roles..." />
    </div>
  );
}


// --- Org Members Tab ---
function OrgMembersTab({ users, departments, roles, loading }: { users: UserProfile[], departments: Department[], roles: Role[], loading: boolean }) {
  const orgMemberColumns = useMemo(() => getOrgMemberColumns(departments, roles), [departments, roles]);
  
  if (loading) {
    return (
        <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-48 w-full" />
        </div>
    )
  }

  return (
    <div>
        <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Permissions Management</AlertTitle>
            <AlertDescription>
                To manage user permissions, districts, and status, please go to the <a href="/admin/users" className="font-semibold underline">User Access Management</a> page (Platform Admins only).
            </AlertDescription>
        </Alert>
        <DataTable columns={orgMemberColumns} data={users} filterColumnId="displayName" filterPlaceholder="Filter by name..." />
    </div>
    )
}

function AccessDenied() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view this page.</p>
        </CardContent>
      </Card>
    );
}

// --- Main Page Component ---
export default function OrganizationPage() {
  const { userProfile, isPlatformAdminClaim } = useAuth();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const authOpts = { isPlatformAdminClaim };
  const canViewMembers = canViewPage(userProfile, 'organization_orgMembers', authOpts);
  const canViewDepts = canViewPage(userProfile, 'organization_departments', authOpts);
  const canViewRoles = canViewPage(userProfile, 'organization_roles', authOpts);
  const canWriteDepts = canDo(userProfile, 'organization_departments', 'update', authOpts);
  const canDelDepts = canDo(userProfile, 'organization_departments', 'delete', authOpts);
  const canWriteRoles = canDo(userProfile, 'organization_roles', 'update', authOpts);
  const canDelRoles = canDo(userProfile, 'organization_roles', 'delete', authOpts);

  useEffect(() => {
    let userUnsub: () => void = () => {};
    let deptUnsub: () => void = () => {};
    let roleUnsub: () => void = () => {};
    
    setLoading(true);

    if (canViewMembers) {
        userUnsub = onSnapshot(query(collection(db, 'users'), orderBy('displayName', 'asc')), (snap) => {
            setUsers(snap.docs.map(d => d.data() as UserProfile));
        });
    }

    if (canViewDepts) {
        const deptListRef = doc(db, 'lists', 'departments');
        deptUnsub = onSnapshot(deptListRef, async (snap) => {
            if (snap.exists()) {
                const listData = snap.data() as DepartmentListDoc;
                const depts = Object.entries(listData.departments || {}).map(([id, data]) => ({ id, ...data } as Department));
                setDepartments(depts.sort((a,b) => a.name.localeCompare(b.name)));
            } else {
                console.log("Departments list document not found. Creating it...");
                await setDoc(deptListRef, { departments: {} });
            }
        });
    }

    if (canViewRoles) {
        const roleListRef = doc(db, 'lists', 'roles');
        roleUnsub = onSnapshot(roleListRef, async (snap) => {
            if (snap.exists()) {
                const listData = snap.data() as RoleListDoc;
                const pos = Object.entries(listData.roles || {}).map(([id, data]) => ({ id, ...data } as Role));
                setRoles(pos.sort((a,b) => a.name.localeCompare(b.name)));
            } else {
                console.log("Roles list document not found. Creating it...");
                await setDoc(roleListRef, { roles: {} });
            }
        });
    }

    // A simple timeout to bundle loading states
    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
        userUnsub();
        deptUnsub();
        roleUnsub();
        clearTimeout(timer);
    }
  }, [canViewMembers, canViewDepts, canViewRoles]);

  if (!canViewMembers && !canViewDepts && !canViewRoles) {
      return <AccessDenied />;
  }

  const defaultTab = canViewMembers ? "org-members" : canViewDepts ? "departments" : "roles";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>
          Manage organization members, departments, and roles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            {canViewMembers && <TabsTrigger value="org-members">Org Members</TabsTrigger>}
            {canViewDepts && <TabsTrigger value="departments">Departments</TabsTrigger>}
            {canViewRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
          </TabsList>
          {canViewMembers && <TabsContent value="org-members"><OrgMembersTab users={users} departments={departments} roles={roles} loading={loading} /></TabsContent>}
          {canViewDepts && <TabsContent value="departments"><DepartmentsTab departments={departments} loading={loading} canWrite={canWriteDepts} canDel={canDelDepts} /></TabsContent>}
          {canViewRoles && <TabsContent value="roles"><RolesTab roles={roles} loading={loading} canWrite={canWriteRoles} canDel={canDelRoles} /></TabsContent>}
        </Tabs>
      </CardContent>
    </Card>
  );
}

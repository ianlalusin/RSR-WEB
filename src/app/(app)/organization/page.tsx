'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Department, Position, UserProfile, DepartmentListDoc, PositionListDoc } from '@/lib/types';
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
import { addDepartment, updateDepartment, deleteDepartment, addPosition, updatePosition, deletePosition } from '@/app/actions';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const { userProfile } = useAuth();
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
    const actor = { uid: userProfile.uid, email: userProfile.email };
    try {
      const result = isEditMode
        ? await updateDepartment(department.id, values, actor)
        : await addDepartment(values, actor);

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

// --- Position Form ---
const positionFormSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
});

type PositionFormValues = z.infer<typeof positionFormSchema>;

function PositionFormDialog({
  position,
  children,
  onSuccess,
}: {
  position?: Position;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isEditMode = !!position;

  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset(isEditMode ? { name: position.name } : { name: ''});
    }
  }, [isOpen, position, form, isEditMode]);

  const onSubmit = async (values: PositionFormValues) => {
    if (!userProfile) return;
    const actor = { uid: userProfile.uid, email: userProfile.email };
    try {
      const result = isEditMode
        ? await updatePosition(position.id, values, actor)
        : await addPosition(values, actor);

      if (result.success) {
        toast({ title: `Position ${isEditMode ? 'updated' : 'added'}` });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Position' : 'Add New Position'}</DialogTitle>
          <DialogDescription>Positions are for organizational grouping only. Permissions are managed per-user.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Position Name</FormLabel><FormControl><Input placeholder="e.g., Field Coordinator" {...field} /></FormControl><FormMessage /></FormItem> )} />
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save Changes' : 'Create Position'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Delete Position Alert ---
function DeletePositionAlert({ position, children, onSuccess }: { position: Position; children: React.ReactNode; onSuccess?: () => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const handleDelete = async () => {
    if (!userProfile) return;
    const actor = { uid: userProfile.uid, email: userProfile.email };
    setIsDeleting(true);
    try {
      const result = await deletePosition(position.id, actor);
      if (result.success) {
        toast({ title: 'Position Deleted' });
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
          <AlertDialogDescription>This will permanently delete the <strong>{position.name}</strong> position.</AlertDialogDescription>
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

// --- Positions Tab ---
function PositionsTab({ positions, loading, canWrite, canDel }: { positions: Position[], loading: boolean, canWrite: boolean, canDel: boolean }) {
  const positionColumns: ColumnDef<Position>[] = [
    { accessorKey: 'name', header: 'Position' },
    {
      id: 'actions',
      cell: ({ row }) => {
        const position = row.original;
        if (!canWrite) return null;
        return (
          <div className="text-right">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <PositionFormDialog position={position}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                </PositionFormDialog>
                {canDel && <>
                    <DropdownMenuSeparator />
                    <DeletePositionAlert position={position}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                    </DeletePositionAlert>
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
            <PositionFormDialog>
                <Button><PlusCircle className="mr-2 h-4 w-4" />Add Position</Button>
            </PositionFormDialog>
            )}
        </div>
        <DataTable columns={positionColumns} data={positions} filterColumnId="name" filterPlaceholder="Filter positions..." />
    </div>
  );
}


// --- Org Members Tab ---
function OrgMembersTab({ users, departments, positions, loading }: { users: UserProfile[], departments: Department[], positions: Position[], loading: boolean }) {
  const orgMemberColumns = useMemo(() => getOrgMemberColumns(departments, positions), [departments, positions]);
  
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
  const { userProfile } = useAuth();
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewMembers = canViewPage(userProfile, 'organization_orgMembers');
  const canViewDepts = canViewPage(userProfile, 'organization_departments');
  const canViewPositions = canViewPage(userProfile, 'organization_positions');
  const canWriteDepts = canDo(userProfile, 'organization_departments', 'update');
  const canDelDepts = canDo(userProfile, 'organization_departments', 'delete');
  const canWritePositions = canDo(userProfile, 'organization_positions', 'update');
  const canDelPositions = canDo(userProfile, 'organization_positions', 'delete');

  useEffect(() => {
    let userUnsub: () => void = () => {};
    let deptUnsub: () => void = () => {};
    let posUnsub: () => void = () => {};
    
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

    if (canViewPositions) {
        const posListRef = doc(db, 'lists', 'positions');
        posUnsub = onSnapshot(posListRef, async (snap) => {
            if (snap.exists()) {
                const listData = snap.data() as PositionListDoc;
                const pos = Object.entries(listData.positions || {}).map(([id, data]) => ({ id, ...data } as Position));
                setPositions(pos.sort((a,b) => a.name.localeCompare(b.name)));
            } else {
                console.log("Positions list document not found. Creating it...");
                await setDoc(posListRef, { positions: {} });
            }
        });
    }

    // A simple timeout to bundle loading states
    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
        userUnsub();
        deptUnsub();
        posUnsub();
        clearTimeout(timer);
    }
  }, [canViewMembers, canViewDepts, canViewPositions]);

  if (!canViewMembers && !canViewDepts && !canViewPositions) {
      return <AccessDenied />;
  }

  const defaultTab = canViewMembers ? "org-members" : canViewDepts ? "departments" : "positions";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>
          Manage organization members, departments, and positions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList>
            {canViewMembers && <TabsTrigger value="org-members">Org Members</TabsTrigger>}
            {canViewDepts && <TabsTrigger value="departments">Departments</TabsTrigger>}
            {canViewPositions && <TabsTrigger value="positions">Positions</TabsTrigger>}
          </TabsList>
          {canViewMembers && <TabsContent value="org-members"><OrgMembersTab users={users} departments={departments} positions={positions} loading={loading} /></TabsContent>}
          {canViewDepts && <TabsContent value="departments"><DepartmentsTab departments={departments} loading={loading} canWrite={canWriteDepts} canDel={canDelDepts} /></TabsContent>}
          {canViewPositions && <TabsContent value="positions"><PositionsTab positions={positions} loading={loading} canWrite={canWritePositions} canDel={canDelPositions} /></TabsContent>}
        </Tabs>
      </CardContent>
    </Card>
  );
}

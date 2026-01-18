'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Coordinator, Department, UserProfile } from '@/lib/types';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { addDepartment, updateDepartment, deleteDepartment } from '@/app/actions';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { mockCoordinators } from '@/lib/data';


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
    defaultValues: {
      name: department?.name || '',
      description: department?.description || '',
    },
  });
  
  useEffect(() => {
    if (department) {
        form.reset({
            name: department.name,
            description: department.description || '',
        })
    }
  }, [department, form]);

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Department' : 'Add New Department'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Finance" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="What does this department do?" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
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
    { accessorKey: 'description', header: 'Description', cell: ({row}) => <p className='line-clamp-2 text-muted-foreground'>{row.original.description}</p> },
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

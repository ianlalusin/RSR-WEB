'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { updateDepartment } from '@/app/actions';
import { Department, PageKey } from '@/lib/types';
import { ALL_PAGE_KEYS } from '@/lib/access';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

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

const formSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  description: z.string().optional(),
  pageVisibility: z.record(z.boolean()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  department: Department | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function DepartmentEditDialog({ department, isOpen, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      pageVisibility: {},
    },
  });

  useEffect(() => {
    if (department) {
      const defaultVisibility = ALL_PAGE_KEYS.reduce((acc, key) => {
        acc[key] = department.pageVisibility?.[key] ?? true; // Default to true if not set
        return acc;
      }, {} as Record<string, boolean>);

      form.reset({
        name: department.name,
        description: department.description || '',
        pageVisibility: defaultVisibility,
      });
    }
  }, [department, form]);
  
  if (!department) return null;

  const onSubmit = async (values: FormValues) => {
    if (!userProfile) return;
    const actor = { uid: userProfile.uid, email: userProfile.email };
    
    try {
        const payload = {
            name: values.name,
            description: values.description,
            pageVisibility: values.pageVisibility,
        };
      const result = await updateDepartment(department.id, payload, actor);

      if (result.success) {
        toast({ title: `Department updated` });
        onOpenChange(false);
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Department: {department.name}</DialogTitle>
          <DialogDescription>
            Update department details and manage page visibility for its members.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem> <FormLabel>Name</FormLabel> <FormControl><Input {...field} /></FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem> <FormLabel>Description</FormLabel> <FormControl><Textarea {...field} value={field.value || ''} /></FormControl> <FormMessage /> </FormItem> )} />
                
                <div>
                  <FormLabel className="text-base font-semibold">Page Visibility</FormLabel>
                  <p className="text-sm text-muted-foreground">Control which pages are visible in the sidebar for members of this department.</p>
                  <div className="mt-2 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Page</TableHead>
                          <TableHead className="text-right w-[100px]">Visible</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ALL_PAGE_KEYS.map((key) => (
                          <TableRow key={key}>
                            <TableCell>{PAGE_LABELS[key]}</TableCell>
                            <TableCell className="text-right">
                              <FormField
                                control={form.control}
                                name={`pageVisibility.${key}`}
                                render={({ field }) => (
                                    <FormItem className="flex justify-end">
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

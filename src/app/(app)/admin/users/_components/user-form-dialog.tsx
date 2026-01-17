'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { useToast } from '@/hooks/use-toast';
import { updateUser } from '@/app/actions';
import type { UserProfile, UserRole } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const ALL_ROLES: UserRole[] = ['admin', 'office', 'coordinator', 'district_head', 'auditor'];
const ALL_PERMISSIONS = ['brgy.read', 'brgy.write', 'brgy.captain.write', 'admin.users.manage'];


const formSchema = z.object({
  roles: z.array(z.string()).default([]),
  permissions: z.record(z.boolean()).default({}),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  user: UserProfile;
  children: React.ReactNode;
  onSuccess?: () => void;
}


export default function UserFormDialog({ user, children, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile: actor } = useAuth();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roles: user.roles || [],
      permissions: user.permissions || {},
    },
  });

  const onSubmit = async (values: FormValues) => {
    if (!actor) return;
    try {
      const result = await updateUser(user.uid, values, {uid: actor.uid, email: actor.email});
      if (result.success) {
        toast({
          title: `User updated`,
          description: `${user.displayName}'s profile has been successfully updated.`,
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
          <DialogTitle>Edit User: {user.displayName}</DialogTitle>
          <DialogDescription>
            Modify roles and permissions for {user.email}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
                control={form.control}
                name="roles"
                render={() => (
                    <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base">Roles</FormLabel>
                            <FormMessage />
                        </div>
                        <div className="space-y-2">
                        {ALL_ROLES.map((role) => (
                            <FormField
                            key={role}
                            control={form.control}
                            name="roles"
                            render={({ field }) => {
                                return (
                                <FormItem
                                    key={role}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(role)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...field.value, role])
                                            : field.onChange(
                                                field.value?.filter(
                                                (value) => value !== role
                                                )
                                            )
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal capitalize">
                                        {role.replace('_', ' ')}
                                    </FormLabel>
                                </FormItem>
                                )
                            }}
                            />
                        ))}
                        </div>
                    </FormItem>
                )}
             />

            <FormField
                control={form.control}
                name="permissions"
                render={() => (
                    <FormItem>
                        <div className="mb-4">
                            <FormLabel className="text-base">Permissions</FormLabel>
                             <FormMessage />
                        </div>
                        <div className="space-y-2">
                        {ALL_PERMISSIONS.map((permission) => (
                            <Controller
                                key={permission}
                                name={`permissions.${permission}`}
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                         <FormLabel className="font-normal">
                                            {permission}
                                        </FormLabel>
                                    </FormItem>
                                )}
                            />
                        ))}
                        </div>
                    </FormItem>
                )}
            />

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
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

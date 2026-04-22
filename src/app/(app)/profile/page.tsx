'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { updatePassword } from 'firebase/auth';
import { canViewPage } from '@/lib/access';
import { AlertTriangle, Edit, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { updateSelfProfile } from '@/app/actions';

const passwordFormSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const profileFormSchema = z.object({
    displayName: z.string().min(1, 'Display name cannot be empty.'),
    photoURL: z.string().url('Must be a valid URL.').or(z.literal('')).optional(),
});


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

export default function ProfilePage() {
    const { user, userProfile, loading } = useAuth();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            password: '',
            confirmPassword: '',
        },
    });

    const profileForm = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            displayName: userProfile?.displayName || '',
            photoURL: userProfile?.photoURL || '',
        },
    });
    
    if (!canViewPage(userProfile, 'profile')) {
        return <AccessDenied />;
    }

    if (loading || !user || !userProfile) return null;

    const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Not authenticated' });
            return;
        }
        try {
            await updatePassword(user, values.password);
            toast({ title: 'Success', description: 'Your password has been updated.' });
            passwordForm.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error updating password', description: error.message });
        }
    };

    const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Not authenticated' });
            return;
        }

        const result = await updateSelfProfile(user.uid, {
            displayName: values.displayName || '',
            photoURL: values.photoURL || '',
        }, await user!.getIdToken());

        if (result.success) {
            toast({ title: 'Profile Updated', description: 'Your profile has been successfully updated.' });
            setIsEditing(false);
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
    };
    
    const handleEditClick = () => {
        profileForm.reset({
            displayName: userProfile.displayName || '',
            photoURL: userProfile.photoURL || '',
        });
        setIsEditing(true);
    };

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>Manage your account settings.</CardDescription>
                    </div>
                    {!isEditing && (
                        <Button variant="outline" onClick={handleEditClick}>
                            <Edit className="mr-2" />
                            Edit Profile
                        </Button>
                    )}
                </CardHeader>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardContent>
                            {isEditing ? (
                                <div className="space-y-4">
                                     <FormField
                                        control={profileForm.control}
                                        name="displayName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Display Name</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={profileForm.control}
                                        name="photoURL"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Photo URL</FormLabel>
                                                <FormControl><Input placeholder="https://example.com/avatar.png" {...field} value={field.value || ''} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-medium">Display Name</h3>
                                        <p className="text-muted-foreground">{userProfile.displayName || 'Not set'}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-medium">Email</h3>
                                        <p className="text-muted-foreground">{userProfile.email}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-medium">Role</h3>
                                        <p className="text-muted-foreground capitalize">{userProfile.roleId?.replace(/_/g, ' ') || 'Not assigned'}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                        {isEditing && (
                             <CardFooter className="justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                                    {profileForm.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                    Save Changes
                                </Button>
                            </CardFooter>
                        )}
                    </form>
                </Form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Enter a new password for your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                            <FormField
                                control={passwordForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                                {passwordForm.formState.isSubmitting ? 'Updating...' : 'Update Password'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/providers/auth-provider';
import { addTask } from '@/app/actions';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { TaskColor, TaskPriority } from '@/lib/types';

const TASK_COLORS: TaskColor[] = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const COLOR_SWATCHES: Record<TaskColor, string> = {
  gray: 'bg-gray-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
};

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  color: z.enum(['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']),
  assigneeUids: z.array(z.string()).default([]),
  dueDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UserOption {
  uid: string;
  displayName: string;
}

export default function TaskFormDialog({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      color: 'blue',
      assigneeUids: [],
      dueDate: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(
      query(collection(db, 'users'), where('isActive', '==', true)),
      (snap) => {
        const items = snap.docs
          .map((d) => ({ uid: d.data().uid, displayName: d.data().displayName || d.data().email || 'Unknown' }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(items);
      }
    );
    return () => unsub();
  }, [isOpen]);

  const onSubmit = async (values: FormValues) => {
    if (!user || !userProfile) return;

    const selectedUsers = users.filter((u) => values.assigneeUids.includes(u.uid));
    const status = values.assigneeUids.length > 0 ? 'assigned' : 'created';

    const result = await addTask(
      {
        title: values.title,
        description: values.description,
        priority: values.priority,
        color: values.color,
        status,
        assigneeUids: values.assigneeUids,
        assigneeNames: selectedUsers.map((u) => u.displayName),
        dueDate: values.dueDate ? Timestamp.fromDate(new Date(values.dueDate)) : undefined,
        createdByUid: user.uid,
        createdByName: userProfile.displayName || user.email || 'Unknown',
      },
      await user!.getIdToken()
    );

    if (result.success) {
      toast({ title: 'Task Created' });
      form.reset();
      setIsOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Create a task and optionally assign it to team members.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input placeholder="Task title" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl><Textarea placeholder="Details..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (optional)</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="color" render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <div className="flex gap-2">
                  {TASK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className={`h-6 w-6 rounded-full ${COLOR_SWATCHES[c]} ${field.value === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="assigneeUids" render={() => (
              <FormItem>
                <FormLabel>Assign To</FormLabel>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                  {users.map((u) => (
                    <FormField
                      key={u.uid}
                      control={form.control}
                      name="assigneeUids"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(u.uid)}
                              onCheckedChange={(checked) =>
                                checked
                                  ? field.onChange([...(field.value || []), u.uid])
                                  : field.onChange((field.value || []).filter((v) => v !== u.uid))
                              }
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">{u.displayName}</FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                  {users.length === 0 && <p className="text-sm text-muted-foreground">Loading users...</p>}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

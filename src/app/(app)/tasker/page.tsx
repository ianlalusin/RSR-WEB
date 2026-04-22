'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import { TaskRecord, TaskStatus } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, isPlatformAdmin, isOIC } from '@/lib/access';
import { updateTaskStatus } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from './_components/kanban-column';
import { TaskCard } from './_components/task-card';
import TaskFormDialog from './_components/task-form-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const STATUSES: TaskStatus[] = ['created', 'assigned', 'acknowledged', 'doing', 'done', 'failed', 'voided'];

export default function TaskerPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);

  const canView = canViewPage(userProfile, 'tasker', { isPlatformAdminClaim });
  const canCreate = isPlatformAdmin(userProfile, isPlatformAdminClaim) || isOIC(userProfile);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(collection(db, 'tasks'), (snap) => {
      const items = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TaskRecord));
      setTasks(items);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    });

    return () => unsub();
  }, [canView]);

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !user) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target status: either the column id or the status of the task we dropped over
    let targetStatus: TaskStatus;
    if (STATUSES.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetStatus = overTask.status;
    }

    if (task.status === targetStatus) return;

    // Check permissions: assigned users can only move their own tasks
    const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim) || isOIC(userProfile);
    const isAssignee = task.assigneeUids.includes(user.uid);
    if (!isAdmin && !isAssignee) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You can only move tasks assigned to you.' });
      return;
    }

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)));

    const result = await updateTaskStatus(taskId, targetStatus, await user!.getIdToken());
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
      // Revert
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)));
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    let targetStatus: TaskStatus;
    if (STATUSES.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      targetStatus = overTask.status;
    }

    if (activeTask.status !== targetStatus) {
      setTasks((prev) => prev.map((t) => (t.id === active.id ? { ...t, status: targetStatus } : t)));
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasker</h1>
          <p className="text-muted-foreground">Drag and drop tasks across statuses.</p>
        </div>
        {canCreate && (
          <TaskFormDialog>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </TaskFormDialog>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-4" style={{ minHeight: '500px' }}>
            {STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={getTasksByStatus(status)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

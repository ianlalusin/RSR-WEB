'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskRecord, TaskStatus } from '@/lib/types';
import { TaskCard } from './task-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_CONFIG: Record<TaskStatus, { label: string; headerColor: string }> = {
  created: { label: 'Created', headerColor: 'bg-slate-100 text-slate-700' },
  assigned: { label: 'Assigned', headerColor: 'bg-blue-100 text-blue-700' },
  acknowledged: { label: 'Acknowledged', headerColor: 'bg-cyan-100 text-cyan-700' },
  doing: { label: 'Doing', headerColor: 'bg-amber-100 text-amber-700' },
  done: { label: 'Done', headerColor: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', headerColor: 'bg-red-100 text-red-700' },
  voided: { label: 'Voided', headerColor: 'bg-gray-100 text-gray-500' },
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskRecord[];
}

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = STATUS_CONFIG[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg bg-muted/50 border min-w-[240px] w-[240px] shrink-0',
        isOver && 'ring-2 ring-primary/50 bg-primary/5'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <Badge variant="secondary" className={cn('text-xs font-medium', config.headerColor)}>
          {config.label}
        </Badge>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[60px]">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TaskRecord } from '@/lib/types';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const COLOR_MAP: Record<string, string> = {
  gray: 'border-l-gray-400',
  red: 'border-l-red-500',
  orange: 'border-l-orange-500',
  yellow: 'border-l-yellow-500',
  green: 'border-l-green-500',
  blue: 'border-l-blue-500',
  purple: 'border-l-purple-500',
  pink: 'border-l-pink-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(ts: Timestamp | Date | undefined) {
  if (!ts) return null;
  const date = ts instanceof Timestamp ? ts.toDate() : ts;
  return format(date, 'MMM d');
}

interface TaskCardProps {
  task: TaskRecord;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          'border-l-4 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow',
          COLOR_MAP[task.color] || COLOR_MAP.gray,
          isDragging && 'opacity-50 shadow-lg'
        )}
        onClick={onClick}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium leading-tight">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', PRIORITY_COLORS[task.priority])}>
              {task.priority}
            </Badge>
            {task.dueDate && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {formatDate(task.dueDate)}
              </Badge>
            )}
          </div>
          {task.assigneeNames.length > 0 && (
            <div className="flex -space-x-1">
              {task.assigneeNames.slice(0, 3).map((name, i) => (
                <Avatar key={i} className="h-5 w-5 border border-background">
                  <AvatarFallback className="text-[8px]">{getInitials(name)}</AvatarFallback>
                </Avatar>
              ))}
              {task.assigneeNames.length > 3 && (
                <span className="text-[10px] text-muted-foreground ml-2">+{task.assigneeNames.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

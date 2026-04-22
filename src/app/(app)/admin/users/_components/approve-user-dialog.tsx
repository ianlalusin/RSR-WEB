'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { updateUserAccess } from '@/app/actions';
import { UserProfile, Department, Role, PageKey, AccessLevel } from '@/lib/types';
import { ALL_PAGE_KEYS } from '@/lib/access';
import { useAuth } from '@/components/providers/auth-provider';
import { Loader2, UserCheck } from 'lucide-react';

function getInitials(name: string | null | undefined) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

interface Props {
  user: UserProfile;
  departments: Department[];
  roles: Role[];
  onSuccess?: () => void;
  children: React.ReactNode;
}

export default function ApproveUserDialog({ user, departments, roles, onSuccess, children }: Props) {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRole = roles.find(r => r.id === roleId);

  const handleApprove = async () => {
    if (!roleId) {
      toast({ variant: 'destructive', title: 'Select a role before approving.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build page access from the role's preset, falling back to restricted
      const pages = ALL_PAGE_KEYS.reduce((acc, key) => {
        const level = (selectedRole?.preset?.[key] as AccessLevel) ?? 'restricted';
        acc[key as PageKey] = { level };
        return acc;
      }, {} as Record<PageKey, { level: AccessLevel }>);

      const chosenDept = departmentId === 'none' ? undefined : departmentId;
      const payload: Partial<UserProfile> = {
        isActive: true,
        roleId,
        ...(chosenDept ? { departmentId: chosenDept } : {}),
        access: {
          pages,
          districtIds: selectedRole?.scopeBreadth === 'none' ? [] : (user.access?.districtIds ?? []),
        },
      };

      const originalData: Partial<UserProfile> = {
        isActive: user.isActive,
        roleId: user.roleId,
        departmentId: user.departmentId,
        access: user.access,
      };

      const actorToken = await authUser!.getIdToken();
      const result = await updateUserAccess(user.uid, payload, actorToken, originalData);

      if (result.success) {
        toast({
          title: 'User approved',
          description: `${user.displayName || user.email} is now active as ${selectedRole?.name}.`,
        });
        setIsOpen(false);
        setRoleId('');
        setDepartmentId('');
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Approve Sign-up Request</DialogTitle>
          <DialogDescription>
            Assign a role to activate this account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <Avatar>
            <AvatarImage src={user.photoURL || ''} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{user.displayName || '—'}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role <span className="text-destructive">*</span></Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles
                  .filter(r => r.status === 'active' && r.id !== 'platformAdmin')
                  .sort((a, b) => b.rank - a.rank)
                  .map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedRole && (
              <p className="text-xs text-muted-foreground">
                Scope: <span className="font-medium capitalize">{selectedRole.scopeBreadth.replace('_', ' ')}</span>
                {selectedRole.preset ? ' · Preset will be applied automatically.' : ''}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Department <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {departments
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!roleId || isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <UserCheck className="mr-2 h-4 w-4" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

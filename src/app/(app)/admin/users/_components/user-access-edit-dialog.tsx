'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { updateUserAccess } from '@/app/actions';
import {
  UserProfile,
  Department,
  Role,
  PageKey,
  AccessLevel,
  SocmedRole,
} from '@/lib/types';
import { ALL_PAGE_KEYS, assignableRoles, resolveScopeBreadth } from '@/lib/access';
import { useAuth } from '@/components/providers/auth-provider';
import { Loader2, Wand2 } from 'lucide-react';

// Scholarship keys exist in ALL_PAGE_KEYS for forward-compatibility but
// have no live routes yet — hide them from the permissions table.
const SCHOLARSHIP_KEYS = new Set<PageKey>([
  'scholarship_providers',
  'scholarship_applications',
  'scholarship_scholars',
  'scholarship_portal',
]);

const VISIBLE_PAGE_KEYS = ALL_PAGE_KEYS.filter(k => !SCHOLARSHIP_KEYS.has(k));

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  barangays_list: 'Barangays (List)',
  barangay_detail: 'Barangay (Detail)',
  organization_orgMembers: 'Organization - Members',
  organization_departments: 'Organization - Departments',
  organization_roles: 'Organization - Roles',
  receiving: 'Receiving',
  projects_medical: 'Projects - Medical',
  projects_hospitals: 'Projects - Hospitals',
  projects_educational: 'Projects - Educational',
  projects_infrastructure: 'Projects - Infrastructure',
  tasker: 'Tasker',
  analytics: 'Analytics',
  profile: 'User Profile',
  admin_users: 'Admin - User Management',
  socmed: 'SocMed',
  scholarship_providers: 'Scholarship - Providers',
  scholarship_applications: 'Scholarship - Applications',
  scholarship_scholars: 'Scholarship - Scholars',
  scholarship_portal: 'Scholarship - Portal',
};

const ACCESS_LEVELS: [AccessLevel, ...AccessLevel[]] = ['restricted', 'readonly', 'readwrite', 'full'];

const SOCMED_ROLES: SocmedRole[] = ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'];

const formSchema = z.object({
  isActive: z.boolean(),
  departmentId: z.string().optional(),
  roleId: z.string().optional(),
  socmedRole: z.string().optional(),
  access: z.object({
    districtIds: z.array(z.string()).default([]),
    barangayIds: z.array(z.string()).default([]),
    pages: z.record(z.enum(ACCESS_LEVELS)),
  }),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  user: UserProfile;
  actor: UserProfile;
  departments: Department[];
  roles: Role[];
  districts: { id: string; name: string }[];
  onSuccess?: () => void;
  children: React.ReactNode;
}

export default function UserAccessEditDialog({
  user,
  actor,
  departments,
  roles,
  districts,
  onSuccess,
  children,
}: Props) {
  const { toast } = useToast();
  const { user: authUser, isPlatformAdminClaim } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const allowedRoles = assignableRoles(actor, { isPlatformAdminClaim, roles });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isActive: user.isActive,
      departmentId: user.departmentId || '',
      roleId: user.roleId || '',
      socmedRole: user.socmedRole || 'none',
      access: {
        districtIds: user.access?.districtIds || [],
        barangayIds: user.access?.barangayIds || [],
        pages: (ALL_PAGE_KEYS.reduce((acc, key) => {
          acc[key] = user.access?.pages?.[key]?.level || 'restricted';
          return acc;
        }, {} as Record<PageKey, AccessLevel>)),
      },
    },
  });

  // Barangays for the barangay-scope picker (coordinators). Loaded from the
  // denormalized lists/barangays doc when the dialog opens.
  const [barangays, setBarangays] = useState<{ id: string; name: string; districtName: string }[]>([]);
  const [barangayFilter, setBarangayFilter] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const snap = await getDoc(doc(db, 'lists', 'barangays'));
      const map = (snap.data()?.barangays ?? {}) as Record<string, { name: string; districtName: string }>;
      setBarangays(
        Object.entries(map)
          .map(([id, b]) => ({ id, name: b.name, districtName: b.districtName }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    })();
  }, [isOpen]);

  // Resolved location scope of the currently selected role drives which
  // scope picker is shown (district vs barangay).
  const selectedScope = useMemo(
    () => resolveScopeBreadth(form.watch('roleId') || undefined, roles),
    [form.watch('roleId'), roles],
  );

  const applyRolePreset = () => {
    const roleId = form.getValues('roleId');
    const roleDoc = roles.find(r => r.id === roleId);
    if (!roleDoc?.preset) return;

    // Apply page access levels
    const pagesFlat: Record<string, AccessLevel> = {};
    ALL_PAGE_KEYS.forEach(key => {
      pagesFlat[key] = (roleDoc.preset![key] as AccessLevel) ?? 'restricted';
    });
    form.setValue('access.pages', pagesFlat, { shouldDirty: true });

    // Apply location scope based on the role's resolved scope tier.
    const scope = resolveScopeBreadth(roleId, roles);
    if (scope === 'all_districts') {
      form.setValue('access.districtIds', districts.map(d => d.id), { shouldDirty: true });
      form.setValue('access.barangayIds', [], { shouldDirty: true });
    } else if (scope === 'none') {
      form.setValue('access.districtIds', [], { shouldDirty: true });
      form.setValue('access.barangayIds', [], { shouldDirty: true });
    } else if (scope === 'own_districts') {
      form.setValue('access.barangayIds', [], { shouldDirty: true });
      // districtIds → user-specific selection, leave as-is
    } else if (scope === 'own_barangays') {
      form.setValue('access.districtIds', [], { shouldDirty: true });
      // barangayIds → user-specific selection, leave as-is
    }

    toast({ title: 'Preset Applied', description: `Permissions set to ${roleDoc.name} defaults.` });
  };

  const onSubmit = async (values: FormValues) => {
    const originalData: Partial<UserProfile> = {
      isActive: user.isActive,
      departmentId: user.departmentId,
      roleId: user.roleId,
      socmedRole: user.socmedRole,
      access: user.access,
    };

    const pagesPayload = Object.entries(values.access.pages).reduce((acc, [key, level]) => {
      acc[key as PageKey] = { level };
      return acc;
    }, {} as Record<PageKey, { level: AccessLevel }>);

    const payload: Partial<UserProfile> = {
      isActive: values.isActive,
      departmentId: values.departmentId,
      roleId: values.roleId,
      socmedRole: (values.socmedRole === 'none' ? null : values.socmedRole) as SocmedRole | undefined,
      access: {
        districtIds: values.access.districtIds,
        barangayIds: values.access.barangayIds,
        pages: pagesPayload,
      },
    };

    try {
      const actorToken = await authUser!.getIdToken();
      const result = await updateUserAccess(user.uid, payload, actorToken, originalData);
      if (result.success) {
        toast({
          title: 'User updated',
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Access for {user.displayName}</DialogTitle>
          <DialogDescription>
            Manage department, role, district scope, and page permissions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[65vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Row 1: Status + Department + Role + SocMed Role */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                          {user.uid === actor.uid && (
                            <FormDescription className="text-xs">
                              Cannot deactivate yourself.
                            </FormDescription>
                          )}
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={user.uid === actor.uid}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allowedRoles.map(role => (
                              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="socmedRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SocMed Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="No SocMed role" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {SOCMED_ROLES.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Apply Preset button */}
                {(() => {
                  const selectedRole = roles.find(r => r.id === form.watch('roleId'));
                  return selectedRole?.preset ? (
                    <Button type="button" variant="outline" size="sm" onClick={applyRolePreset}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Apply {selectedRole.name} Preset
                    </Button>
                  ) : null;
                })()}

                {/* Location Scope — driven by the selected role's scope tier */}
                <div>
                  <FormLabel className="text-base font-semibold">Location Scope</FormLabel>
                  {selectedScope === 'all_districts' && (
                    <p className="pt-2 text-sm text-muted-foreground">This role sees records in <strong>all districts</strong> — no per-user selection needed.</p>
                  )}
                  {selectedScope === 'none' && (
                    <p className="pt-2 text-sm text-muted-foreground">This role has <strong>no access</strong> to location-tagged records.</p>
                  )}

                  {selectedScope === 'own_districts' && (
                    <FormField
                      control={form.control}
                      name="access.districtIds"
                      render={() => (
                        <FormItem>
                          <FormDescription>District lead — select the district(s) this user oversees (all barangays within).</FormDescription>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                            {districts.map((d) => (
                              <FormField
                                key={d.id}
                                control={form.control}
                                name="access.districtIds"
                                render={({ field }) => (
                                  <FormItem key={d.id} className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(d.id)}
                                        onCheckedChange={(checked) => (
                                          checked
                                            ? field.onChange([...(field.value || []), d.id])
                                            : field.onChange((field.value || []).filter((v) => v !== d.id))
                                        )}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">{d.name}</FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {selectedScope === 'own_barangays' && (
                    <FormField
                      control={form.control}
                      name="access.barangayIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormDescription>Coordinator — select the specific barangay(s) this user can access.</FormDescription>
                          <Input
                            placeholder="Filter barangays…"
                            value={barangayFilter}
                            onChange={(e) => setBarangayFilter(e.target.value)}
                            className="mt-2 max-w-xs"
                          />
                          <p className="pt-1 text-xs text-muted-foreground">{(field.value?.length ?? 0)} selected</p>
                          <ScrollArea className="h-56 rounded border mt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                              {barangays
                                .filter((b) => `${b.name} ${b.districtName}`.toLowerCase().includes(barangayFilter.toLowerCase()))
                                .map((b) => (
                                  <label key={b.id} className="flex flex-row items-start space-x-3 space-y-0 cursor-pointer">
                                    <Checkbox
                                      checked={field.value?.includes(b.id)}
                                      onCheckedChange={(checked) => (
                                        checked
                                          ? field.onChange([...(field.value || []), b.id])
                                          : field.onChange((field.value || []).filter((v) => v !== b.id))
                                      )}
                                    />
                                    <span className="text-sm font-normal leading-tight">{b.name} <span className="text-muted-foreground">— {b.districtName}</span></span>
                                  </label>
                                ))}
                              {barangays.length === 0 && <p className="text-sm text-muted-foreground">Loading barangays…</p>}
                            </div>
                          </ScrollArea>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Page Permissions — scholarship keys hidden (no live routes yet) */}
                <div>
                  <FormLabel className="text-base font-semibold">Page Permissions</FormLabel>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead className="text-right">Access Level</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {VISIBLE_PAGE_KEYS.map((key) => (
                        <TableRow key={key}>
                          <TableCell>{PAGE_LABELS[key]}</TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`access.pages.${key}`}
                              render={({ field }) => (
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="flex justify-end space-x-4"
                                >
                                  {ACCESS_LEVELS.map(level => (
                                    <FormItem key={level} className="flex items-center space-x-2 space-y-0">
                                      <FormControl>
                                        <RadioGroupItem value={level} id={`${user.uid}-${key}-${level}`} />
                                      </FormControl>
                                      <FormLabel htmlFor={`${user.uid}-${key}-${level}`} className="font-normal capitalize">{level}</FormLabel>
                                    </FormItem>
                                  ))}
                                </RadioGroup>
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
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

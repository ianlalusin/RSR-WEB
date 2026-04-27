'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage, isPlatformAdmin } from '@/lib/access';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import type { UserProfile, SocmedRole, SocmedGroup } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  createCampaign,
  approveCampaign,
  rejectCampaign,
  rolloutCampaign,
  editRollout,
  deleteCampaign,
  submitProof,
  checkSubmission,
  updateUserSocmedRole,
  createSocmedUser,
  removeSocmedUser,
  createSocmedGroup,
  updateSocmedGroup,
  deleteSocmedGroup,
  type SubtaskDef,
} from '@/app/socmed-actions';

// ============================================================
// TYPES
// ============================================================

interface Campaign {
  id: string;
  url: string;
  title: string;
  description: string;
  submitted_by: string;
  submitted_at: string;
  status: string;
  manager_approved_by: string | null;
  manager_note: string | null;
  validator_approved_by: string | null;
  validator_note: string | null;
  validated_at?: any;
  rejected_by: string | null;
  rejection_reason: string | null;
  deadline: string | null;
  target_agents: string | null;
  subtasks: string | null;
}

interface Submission {
  id: string;
  campaign_id: string;
  agent_id: string;
  subtask_type: string;
  subtask_instruction?: string;
  status: string;
  proof_url: string | null;
  proof_note: string | null;
  submitted_at: any;
  checked_by: string | null;
  checker_note: string | null;
  checked_at: any;
}

type TabKey = 'dashboard' | 'campaigns' | 'validate' | 'rollout' | 'groups' | 'team' | 'users';

// ============================================================
// CONSTANTS
// ============================================================

const SUBTASK_ICONS: Record<string, string> = {
  Engage: '🔥', Comment: '💬', React: '👍',
  Share: '🔁', Report: '🚩', Verify: '✅',
};

const SUBTASK_TYPES = ['Engage', 'Comment', 'React', 'Share', 'Report', 'Verify'];
const SOCMED_ROLES: SocmedRole[] = ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'];

// Status → Tailwind classes (badge-safe)
const STATUS_CLASS: Record<string, string> = {
  pending:          'bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-400',
  manager_approved: 'bg-blue-500/20 text-blue-700 border-blue-500/40 dark:text-blue-400',
  validated:        'bg-purple-500/20 text-purple-700 border-purple-500/40 dark:text-purple-400',
  rejected:         'bg-destructive/20 text-destructive border-destructive/40',
  active:           'bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-400',
  completed:        'bg-primary/20 text-primary border-primary/40',
};

const SUB_STATUS_CLASS: Record<string, string> = {
  pending:   'bg-secondary text-secondary-foreground',
  submitted: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-400',
  approved:  'bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-400',
  rejected:  'bg-destructive/20 text-destructive border-destructive/40',
  flagged:   'bg-orange-500/20 text-orange-700 border-orange-500/40 dark:text-orange-400',
};

// ============================================================
// SMALL REUSABLE COMPONENTS
// ============================================================

function UserAvatar({ name, size = 'sm' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const initials = getInitials(name);
  return (
    <div className={cn(
      'rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0',
      size === 'sm' && 'h-6 w-6 text-[10px]',
      size === 'md' && 'h-8 w-8 text-xs',
      size === 'lg' && 'h-9 w-9 text-sm',
    )}>
      {initials}
    </div>
  );
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return (
    <Badge className={cn('capitalize text-xs', map[status] ?? 'bg-secondary text-secondary-foreground')}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return <Progress value={pct} className="h-1.5" />;
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">{children}</p>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

function AppSelect({ value, onChange, options, className }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm',
        'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className,
      )}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function getUserName(uid: string, users: UserProfile[]): string {
  return users.find(u => u.uid === uid)?.displayName || uid.slice(0, 8);
}

function getUserInitials(uid: string, users: UserProfile[]): string {
  return getInitials(users.find(u => u.uid === uid)?.displayName);
}

function parseJson<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function getSocmedRole(profile: UserProfile | null, isPlatformAdminClaim: boolean): SocmedRole | null {
  if (!profile) return null;
  if (isPlatformAdmin(profile, isPlatformAdminClaim)) return 'Admin';
  return profile.socmedRole || null;
}

function getVisibleTabs(role: SocmedRole | null): { key: TabKey; label: string }[] {
  if (!role) return [];
  const tabs: { key: TabKey; label: string; roles: SocmedRole[] }[] = [
    { key: 'dashboard', label: 'Dashboard', roles: ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'] },
    { key: 'campaigns', label: 'Campaigns', roles: ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'] },
    { key: 'validate',  label: 'Validate',  roles: ['Admin', 'Manager', 'Validator'] },
    { key: 'rollout',   label: 'Rollout',   roles: ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'] },
    { key: 'groups',    label: 'Groups',    roles: ['Admin', 'Manager'] },
    { key: 'team',      label: 'Team',      roles: ['Admin', 'Manager'] },
    { key: 'users',     label: 'Users',     roles: ['Admin', 'Manager', 'Validator'] },
  ];
  return tabs.filter(t => t.roles.includes(role));
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function SocMedPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const authOpts = { isPlatformAdminClaim };

  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<SocmedGroup[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const socmedRole = getSocmedRole(userProfile, isPlatformAdminClaim);
  const visibleTabs = useMemo(() => getVisibleTabs(socmedRole), [socmedRole]);

  const fetchUsers = useCallback(async () => {
    const snap = await getDocs(collection(db, 'users'));
    setAllUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const q = query(collection(db, 'socmedCampaigns'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Campaign));
      setLoadingData(false);
    }, () => setLoadingData(false));
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'socmedSubmissions'));
    const unsub = onSnapshot(q, snap => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Submission));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'socmedGroups'), orderBy('name'));
    const unsub = onSnapshot(q, snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SocmedGroup));
    });
    return unsub;
  }, []);

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);

  if (!canViewPage(userProfile, 'socmed', authOpts)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive" /> Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent><p>You do not have permission to view this page.</p></CardContent>
      </Card>
    );
  }

  if (!socmedRole) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive" /> No SocMed Role
          </CardTitle>
        </CardHeader>
        <CardContent><p>No SocMed role assigned. Contact an Admin.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">SocMed</h2>
        <Badge>{socmedRole}</Badge>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b pb-1">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-3 py-2 text-sm rounded-t-md transition-colors',
              activeTab === t.key
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loadingData ? (
        <EmptyState icon="⏳" text="Loading..." />
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <DashboardTab
              campaigns={campaigns}
              submissions={submissions}
              users={allUsers}
              socmedRole={socmedRole}
              currentUid={user?.uid || ''}
            />
          )}
          {activeTab === 'campaigns' && (
            <CampaignsTab
              campaigns={campaigns}
              submissions={submissions}
              users={allUsers}
              socmedRole={socmedRole}
              currentUid={user?.uid || ''}
              getToken={getToken}
            />
          )}
          {activeTab === 'validate' && (
            <ValidateTab campaigns={campaigns} users={allUsers} getToken={getToken} />
          )}
          {activeTab === 'rollout' && user && (
            <RolloutTab
              campaigns={campaigns}
              submissions={submissions}
              users={allUsers}
              groups={groups}
              socmedRole={socmedRole}
              currentUid={user.uid}
              getToken={getToken}
            />
          )}
          {activeTab === 'groups' && (
            <GroupsTab groups={groups} users={allUsers} getToken={getToken} />
          )}
          {activeTab === 'team' && (
            <TeamTab submissions={submissions} users={allUsers} />
          )}
          {activeTab === 'users' && (
            <UsersTab
              users={allUsers}
              getToken={getToken}
              refreshUsers={fetchUsers}
              currentUid={user?.uid || ''}
              socmedRole={socmedRole}
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// TAB: DASHBOARD
// ============================================================

function DashboardTab({ campaigns, submissions, users, socmedRole, currentUid }: {
  campaigns: Campaign[]; submissions: Submission[]; users: UserProfile[];
  socmedRole: SocmedRole; currentUid: string;
}) {
  const isAgent = socmedRole === 'Agent';

  const mySubs = isAgent ? submissions.filter(s => s.agent_id === currentUid) : submissions;
  const myCampaignIds = new Set(mySubs.map(s => s.campaign_id));
  const visibleCampaigns = isAgent
    ? campaigns.filter(c => myCampaignIds.has(c.id))
    : campaigns;

  const activeCampaigns = visibleCampaigns.filter(c => c.status === 'active');
  const pendingValidation = visibleCampaigns.filter(c => c.status === 'pending' || c.status === 'manager_approved');
  const toCheck = mySubs.filter(s => s.status === 'submitted');
  const approved = mySubs.filter(s => s.status === 'approved');

  const stats = isAgent
    ? [
      { label: 'My Active Campaigns', value: activeCampaigns.length,             color: 'text-green-600 dark:text-green-400' },
      { label: 'My Pending Tasks',     value: mySubs.filter(s => s.status === 'pending').length, color: 'text-yellow-600 dark:text-yellow-400' },
      { label: 'Awaiting Review',      value: toCheck.length,                    color: 'text-blue-600 dark:text-blue-400' },
      { label: 'My Tasks Approved',    value: approved.length,                   color: 'text-primary' },
    ]
    : [
      { label: 'Active Campaigns',     value: activeCampaigns.length,            color: 'text-green-600 dark:text-green-400' },
      { label: 'Pending Validation',   value: pendingValidation.length,          color: 'text-yellow-600 dark:text-yellow-400' },
      { label: 'Submissions to Check', value: toCheck.length,                    color: 'text-blue-600 dark:text-blue-400' },
      { label: 'Tasks Approved',       value: approved.length,                   color: 'text-primary' },
    ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{s.label}</p>
              <p className={cn('text-3xl font-bold mt-1', s.color)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <SectionLabel>{isAgent ? 'My Active Campaigns' : 'Active Campaigns'}</SectionLabel>
        {activeCampaigns.length === 0 ? (
          <EmptyState icon="📢" text={isAgent ? 'No campaigns assigned to you yet' : 'No active campaigns yet'} />
        ) : (
          <div className="space-y-3">
            {activeCampaigns.map(c => {
              const subtasks: SubtaskDef[] = parseJson(c.subtasks) || [];
              const agents: string[] = parseJson(c.target_agents) || [];
              const totalExpected = isAgent ? subtasks.length : subtasks.length * agents.length;
              const approvedCount = isAgent
                ? mySubs.filter(s => s.campaign_id === c.id && s.status === 'approved').length
                : submissions.filter(s => s.campaign_id === c.id && s.status === 'approved').length;
              return (
                <Card key={c.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-sm">{c.title}</p>
                        <a href={c.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400 break-all">{c.url}</a>
                      </div>
                      {c.deadline && <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-400">Due: {c.deadline}</Badge>}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {subtasks.map((st, i) => (
                        <Badge key={i} variant="secondary">{SUBTASK_ICONS[st.type] || ''} {st.type}</Badge>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Progress: {approvedCount}/{totalExpected}</p>
                      <MiniBar value={approvedCount} max={totalExpected} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: CAMPAIGNS
// ============================================================

function CampaignsTab({ campaigns, submissions, users, socmedRole, currentUid, getToken }: {
  campaigns: Campaign[]; submissions: Submission[]; users: UserProfile[];
  socmedRole: SocmedRole; currentUid: string; getToken: () => Promise<string>;
}) {
  const canDelete = socmedRole === 'Admin' || socmedRole === 'Manager';
  const canSeeUnverified = socmedRole === 'Admin' || socmedRole === 'Manager' || socmedRole === 'Validator';
  const visibleCampaigns = canSeeUnverified
    ? campaigns
    : campaigns.filter(c =>
        c.submitted_by === currentUid ||
        c.status === 'validated' ||
        c.status === 'active' ||
        c.status === 'completed'
      );
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (c: Campaign) => {
    if (!window.confirm(`Delete campaign "${c.title}"? This also removes all related submissions and cannot be undone.`)) return;
    setDeletingId(c.id);
    const token = await getToken();
    await deleteCampaign(c.id, token);
    setDeletingId(null);
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!url.trim()) errs.url = 'URL is required';
    else if (!url.startsWith('http')) errs.url = 'URL must start with http';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true); setErrors({});
    const token = await getToken();
    const result = await createCampaign({ url, title, description: desc }, token);
    setSubmitting(false);

    if (result.success) {
      setUrl(''); setTitle(''); setDesc(''); setShowForm(false);
    } else {
      setErrors({ form: result.error || 'Failed to submit' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SectionLabel>Campaigns</SectionLabel>
        <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Submit FB Post'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Campaign Title" />
              <FieldError msg={errors.title} />
            </div>
            <div>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Facebook Post URL (https://...)" />
              <FieldError msg={errors.url} />
            </div>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={3} />
            <FieldError msg={errors.form} />
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Campaign'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {visibleCampaigns.length === 0 ? (
        <EmptyState icon="📋" text="No campaigns yet. Be the first to submit!" />
      ) : (
        <div className="space-y-3">
          {visibleCampaigns.map(c => {
            const subtasks: SubtaskDef[] = parseJson(c.subtasks) || [];
            const agents: string[] = parseJson(c.target_agents) || [];
            const totalExpected = subtasks.length * agents.length;
            const approvedCount = submissions.filter(s => s.campaign_id === c.id && s.status === 'approved').length;

            return (
              <Card key={c.id} className="relative">
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    title="Delete campaign"
                    aria-label="Delete campaign"
                    className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2 pr-8">
                    <span className="font-semibold text-sm truncate min-w-0 flex-1">{c.title}</span>
                    <StatusBadge status={c.status} map={STATUS_CLASS} />
                  </div>

                  <a href={c.url} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:underline dark:text-blue-400 truncate">{c.url}</a>

                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                    <UserAvatar name={getUserName(c.submitted_by, users)} size="sm" />
                    <span>{getUserName(c.submitted_by, users)}</span>
                    <span className="text-muted-foreground/60">· {c.submitted_at}</span>
                    {c.validator_approved_by && (
                      <span>· validated by {getUserName(c.validator_approved_by, users)}</span>
                    )}
                    {subtasks.length > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-sm leading-none">
                        {subtasks.map((st, i) => (
                          <span key={i} title={st.type}>{SUBTASK_ICONS[st.type] || ''}</span>
                        ))}
                      </span>
                    )}
                  </div>

                  {c.status === 'rejected' && c.rejection_reason && (
                    <p className="bg-destructive/10 border border-destructive/30 rounded px-2 py-1 text-xs text-destructive">
                      Rejected: {c.rejection_reason}
                    </p>
                  )}

                  {c.status === 'active' && totalExpected > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{approvedCount}/{totalExpected}</span>
                      <MiniBar value={approvedCount} max={totalExpected} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: VALIDATE
// ============================================================

function ValidateTab({ campaigns, users, getToken }: {
  campaigns: Campaign[]; users: UserProfile[]; getToken: () => Promise<string>;
}) {
  const queue = campaigns.filter(c => c.status === 'pending' || c.status === 'manager_approved');

  return (
    <div className="space-y-3">
      <SectionLabel>Validation Queue</SectionLabel>
      <p className="text-xs text-muted-foreground">
        Each campaign is validated once. The validator who approves it is recorded.
      </p>
      {queue.length === 0 ? (
        <EmptyState icon="✅" text="No campaigns pending validation" />
      ) : (
        <div className="space-y-3">
          {queue.map(c => (
            <ValidateCard key={c.id} campaign={c} users={users} getToken={getToken} />
          ))}
        </div>
      )}
    </div>
  );
}

function ValidateCard({ campaign: c, users, getToken }: {
  campaign: Campaign; users: UserProfile[]; getToken: () => Promise<string>;
}) {
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    setBusy(true); setError('');
    const token = await getToken();
    const result = await approveCampaign(c.id, note, token);
    setBusy(false);
    if (!result.success) { setError(result.error || 'Failed to validate'); return; }
    setNote(''); setRejectReason('');
  };

  const handleReject = async () => {
    setBusy(true); setError('');
    const token = await getToken();
    const result = await rejectCampaign(c.id, rejectReason, token);
    setBusy(false);
    if (!result.success) { setError(result.error || 'Failed to reject'); return; }
    setNote(''); setRejectReason('');
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div>
          <p className="font-semibold text-sm">{c.title}</p>
          <a href={c.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline dark:text-blue-400">{c.url}</a>
          {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <UserAvatar name={getUserName(c.submitted_by, users)} size="sm" />
          <span className="text-xs text-muted-foreground">Submitted by {getUserName(c.submitted_by, users)}</span>
        </div>
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Validation note (optional)" rows={2} />
        <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required to reject)" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={busy}>
            {busy ? 'Processing...' : 'Validate'}
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={busy || !rejectReason.trim()}>
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TAB: ROLLOUT
// ============================================================

function RolloutTab({ campaigns, submissions, users, groups, socmedRole, currentUid, getToken }: {
  campaigns: Campaign[]; submissions: Submission[]; users: UserProfile[]; groups: SocmedGroup[];
  socmedRole: SocmedRole; currentUid: string; getToken: () => Promise<string>;
}) {
  if (socmedRole === 'Agent') {
    return <MyTasksTab campaigns={campaigns} submissions={submissions} currentUid={currentUid} getToken={getToken} />;
  }
  if (socmedRole === 'Checker') {
    return <CheckQueueTab submissions={submissions} campaigns={campaigns} users={users} currentUid={currentUid} getToken={getToken} />;
  }
  return <ManagerRolloutView campaigns={campaigns} users={users} groups={groups} getToken={getToken} />;
}

function ManagerRolloutView({ campaigns, users, groups, getToken }: {
  campaigns: Campaign[]; users: UserProfile[]; groups: SocmedGroup[]; getToken: () => Promise<string>;
}) {
  const validatedCampaigns = campaigns.filter(c => c.status === 'validated');
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');

  const close = () => { setSelectedId(null); setMode('create'); };

  if (selectedId) {
    const campaign = campaigns.find(c => c.id === selectedId);
    if (!campaign) { close(); return null; }
    return (
      <RolloutConfig
        campaign={campaign}
        users={users}
        groups={groups}
        getToken={getToken}
        mode={mode}
        onBack={close}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionLabel>Validated Campaigns Ready for Rollout</SectionLabel>
        {validatedCampaigns.length === 0 ? (
          <EmptyState icon="🚀" text="No validated campaigns to roll out" />
        ) : (
          <div className="space-y-2">
            {validatedCampaigns.map(c => (
              <Card key={c.id}>
                <CardContent className="p-3 flex justify-between items-center flex-wrap gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{c.title}</p>
                    <a href={c.url} target="_blank" rel="noopener noreferrer"
                      className="block text-xs text-blue-600 hover:underline dark:text-blue-400 truncate">{c.url}</a>
                  </div>
                  <Button size="sm" onClick={() => { setMode('create'); setSelectedId(c.id); }}>Configure Rollout</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {activeCampaigns.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>Active Rollouts</SectionLabel>
          <div className="space-y-2">
            {activeCampaigns.map(c => {
              const subtasks: SubtaskDef[] = parseJson(c.subtasks) || [];
              const agentIds: string[] = parseJson(c.target_agents) || [];
              return (
                <Card key={c.id}>
                  <CardContent className="p-3 flex justify-between items-center flex-wrap gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{c.title}</p>
                      <a href={c.url} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-blue-600 hover:underline dark:text-blue-400 truncate">{c.url}</a>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''} · {agentIds.length} agent{agentIds.length !== 1 ? 's' : ''}
                        {c.deadline && ` · due ${c.deadline}`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setMode('edit'); setSelectedId(c.id); }}>
                      Edit Rollout
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


function RolloutConfig({ campaign, users, groups, getToken, mode = 'create', onBack }: {
  campaign: Campaign; users: UserProfile[]; groups: SocmedGroup[]; getToken: () => Promise<string>;
  mode?: 'create' | 'edit'; onBack: () => void;
}) {
  const isEdit = mode === 'edit';
  const initialSubtasks = useMemo<SubtaskDef[]>(
    () => isEdit ? (parseJson<SubtaskDef[]>(campaign.subtasks) || []) : [],
    [isEdit, campaign.subtasks]
  );
  const initialAgents = useMemo<string[]>(
    () => isEdit ? (parseJson<string[]>(campaign.target_agents) || []) : [],
    [isEdit, campaign.target_agents]
  );

  const [subtasks, setSubtasks] = useState<SubtaskDef[]>(initialSubtasks);
  const [stType, setStType] = useState(SUBTASK_TYPES[0]);
  const [stInstruction, setStInstruction] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set(initialAgents));
  const [deadline, setDeadline] = useState(
    isEdit && campaign.deadline ? campaign.deadline : new Date().toISOString().split('T')[0]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const agents = users.filter(u => u.socmedRole === 'Agent' && u.isActive);

  const applyGroup = (groupId: string) => {
    if (!groupId) return;
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    const activeUids = new Set(agents.map(a => a.uid));
    setSelectedAgents(new Set(group.agentIds.filter(uid => activeUids.has(uid))));
  };

  const addSubtask = () => {
    if (!stInstruction.trim()) return;
    setSubtasks([...subtasks, { type: stType, instruction: stInstruction }]);
    setStInstruction('');
  };

  const removeSubtask = (i: number) => setSubtasks(subtasks.filter((_, idx) => idx !== i));

  const toggleAgent = (uid: string) => {
    const next = new Set(selectedAgents);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setSelectedAgents(next);
  };

  const handleRollout = async () => {
    setBusy(true); setError('');
    const token = await getToken();
    const result = isEdit
      ? await editRollout(campaign.id, subtasks, Array.from(selectedAgents), deadline, token)
      : await rolloutCampaign(campaign.id, subtasks, Array.from(selectedAgents), deadline, token);
    setBusy(false);
    if (result.success) onBack();
    else setError(result.error || (isEdit ? 'Save failed' : 'Rollout failed'));
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-primary hover:underline flex items-center gap-1">
        ← Back to list
      </button>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold">{campaign.title}</p>
          <a href={campaign.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline dark:text-blue-400">{campaign.url}</a>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subtasks */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <SectionLabel>Subtasks</SectionLabel>
            {subtasks.length > 0 && (
              <div className="space-y-1.5">
                {subtasks.map((st, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                    <span>{SUBTASK_ICONS[st.type] || ''} {st.type}: {st.instruction}</span>
                    <button onClick={() => removeSubtask(i)} className="text-destructive ml-2 hover:opacity-70 text-base leading-none">&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <AppSelect
                value={stType}
                onChange={setStType}
                options={SUBTASK_TYPES.map(t => ({ value: t, label: `${SUBTASK_ICONS[t]} ${t}` }))}
                className="w-36"
              />
              <Input
                className="flex-1 min-w-32"
                value={stInstruction}
                onChange={e => setStInstruction(e.target.value)}
                placeholder="Instruction"
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
              />
              <Button size="sm" variant="outline" onClick={addSubtask}>Add</Button>
            </div>
          </CardContent>
        </Card>

        {/* Agents & Deadline */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <SectionLabel>Agents</SectionLabel>

            {/* Group + select-all toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {groups.length > 0 && (
                <AppSelect
                  value=""
                  onChange={applyGroup}
                  options={[
                    { value: '', label: 'Assign group…' },
                    ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.agentIds.length})` })),
                  ]}
                  className="flex-1 min-w-36 text-xs"
                />
              )}
              <Button size="sm" variant="outline" className="text-xs h-8"
                onClick={() => setSelectedAgents(new Set(agents.map(a => a.uid)))}
                disabled={agents.length === 0}
              >
                Select all
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-8"
                onClick={() => setSelectedAgents(new Set())}
                disabled={selectedAgents.size === 0}
              >
                Clear
              </Button>
            </div>

            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No agents found. Assign Agent role in Users tab.</p>
            ) : (
              <ScrollArea className="h-40">
                <div className="space-y-2 pr-2">
                  {agents.map(a => (
                    <label key={a.uid} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={selectedAgents.has(a.uid)}
                        onCheckedChange={() => toggleAgent(a.uid)}
                      />
                      <UserAvatar name={a.displayName} size="sm" />
                      <span>{a.displayName || a.email}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div>
              <SectionLabel>Deadline</SectionLabel>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button
          onClick={handleRollout}
          disabled={subtasks.length === 0 || (agents.length > 0 && selectedAgents.size === 0) || busy}
          className="bg-green-600 hover:bg-green-700"
        >
          {busy
            ? (isEdit ? 'Saving...' : 'Rolling out...')
            : isEdit
              ? `Save (${subtasks.length} subtasks × ${selectedAgents.size} agents)`
              : `Rollout (${subtasks.length} subtasks × ${selectedAgents.size} agents)`}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// TAB: MY TASKS (Agent)
// ============================================================

function MyTasksTab({ campaigns, submissions, currentUid, getToken }: {
  campaigns: Campaign[]; submissions: Submission[]; currentUid: string; getToken: () => Promise<string>;
}) {
  const mySubmissions = submissions.filter(s => s.agent_id === currentUid);

  const grouped = useMemo(() => {
    const map = new Map<string, Submission[]>();
    for (const s of mySubmissions) {
      const arr = map.get(s.campaign_id) || [];
      arr.push(s);
      map.set(s.campaign_id, arr);
    }
    return map;
  }, [mySubmissions]);

  if (grouped.size === 0) return <EmptyState icon="📝" text="No tasks assigned to you yet" />;

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([campaignId, subs]) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) return null;
        return (
          <Card key={campaignId}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-sm">{campaign.title}</p>
                  <a href={campaign.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400">{campaign.url}</a>
                </div>
                {campaign.deadline && (
                  <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-400">
                    Due: {campaign.deadline}
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                {subs.map(s => (
                  <SubmissionCard key={s.id} submission={s} getToken={getToken} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SubmissionCard({ submission: s, getToken }: { submission: Submission; getToken: () => Promise<string> }) {
  const [proofUrl, setProofUrl] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmitProof = async () => {
    if (!proofUrl.trim()) { setError('Proof URL is required'); return; }
    setBusy(true); setError('');
    const token = await getToken();
    const result = await submitProof(s.id, proofUrl, proofNote, token);
    setBusy(false);
    if (result.success) { setProofUrl(''); setProofNote(''); }
    else setError(result.error || 'Failed');
  };

  return (
    <div className="bg-muted rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg">{SUBTASK_ICONS[s.subtask_type] || ''}</span>
        <span className="font-semibold text-sm">{s.subtask_type}</span>
        <StatusBadge status={s.status} map={SUB_STATUS_CLASS} />
      </div>
      {s.subtask_instruction && <p className="text-xs text-muted-foreground">{s.subtask_instruction}</p>}

      {s.checker_note && s.status === 'flagged' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2 text-xs text-orange-700 dark:text-orange-400">
          Flagged: {s.checker_note}
        </div>
      )}
      {s.checker_note && s.status === 'rejected' && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-xs text-destructive">
          Rejected: {s.checker_note}
        </div>
      )}
      {s.checker_note && s.status === 'approved' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-400">
          Approved: {s.checker_note}
        </div>
      )}

      {(s.status === 'pending' || s.status === 'rejected' || s.status === 'flagged') && (
        <div className="space-y-2">
          <Input value={proofUrl} onChange={e => setProofUrl(e.target.value)} placeholder="Proof URL (required)" />
          <Input value={proofNote} onChange={e => setProofNote(e.target.value)} placeholder="Note (optional)" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSubmitProof} disabled={busy}>
              {busy ? 'Submitting...' : 'Submit Proof'}
            </Button>
          </div>
        </div>
      )}

      {s.status === 'submitted' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          Awaiting checker review —{' '}
          <a href={s.proof_url || ''} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
            {s.proof_url}
          </a>
        </div>
      )}

      {s.status === 'approved' && s.proof_url && !s.checker_note && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-xs text-green-700 dark:text-green-400">
          Approved —{' '}
          <a href={s.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
            {s.proof_url}
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: CHECK QUEUE (Checker)
// ============================================================

function CheckQueueTab({ submissions, campaigns, users, currentUid, getToken }: {
  submissions: Submission[]; campaigns: Campaign[]; users: UserProfile[]; currentUid: string; getToken: () => Promise<string>;
}) {
  const toCheck = submissions.filter(s => s.status === 'submitted');
  const recentlyChecked = submissions
    .filter(s => s.checked_by === currentUid && ['approved', 'rejected', 'flagged'].includes(s.status))
    .sort((a, b) => (b.checked_at?.seconds || 0) - (a.checked_at?.seconds || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionLabel>Submissions to Review</SectionLabel>
        {toCheck.length === 0 ? (
          <EmptyState icon="🔍" text="No submissions to check right now" />
        ) : (
          <div className="space-y-3">
            {toCheck.map(s => (
              <CheckCard key={s.id} submission={s} campaigns={campaigns} users={users} getToken={getToken} />
            ))}
          </div>
        )}
      </div>

      {recentlyChecked.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>Recently Reviewed</SectionLabel>
          {recentlyChecked.map(s => {
            const campaign = campaigns.find(c => c.id === s.campaign_id);
            return (
              <Card key={s.id} className="opacity-70">
                <CardContent className="pt-3 pb-3 flex items-center gap-2 flex-wrap">
                  <UserAvatar name={getUserName(s.agent_id, users)} size="sm" />
                  <span className="text-xs">{getUserName(s.agent_id, users)}</span>
                  <Badge variant="secondary">{s.subtask_type}</Badge>
                  <StatusBadge status={s.status} map={SUB_STATUS_CLASS} />
                  {campaign && <span className="text-xs text-muted-foreground">{campaign.title}</span>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckCard({ submission: s, campaigns, users, getToken }: {
  submission: Submission; campaigns: Campaign[]; users: UserProfile[]; getToken: () => Promise<string>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const campaign = campaigns.find(c => c.id === s.campaign_id);

  const handleCheck = async (status: 'approved' | 'rejected' | 'flagged') => {
    setBusy(true);
    const token = await getToken();
    await checkSubmission(s.id, status, note, token);
    setBusy(false); setNote('');
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <UserAvatar name={getUserName(s.agent_id, users)} size="md" />
          <div>
            <p className="font-semibold text-sm">{getUserName(s.agent_id, users)}</p>
            {s.submitted_at && (
              <p className="text-xs text-muted-foreground">
                {s.submitted_at?.toDate ? s.submitted_at.toDate().toLocaleDateString() : ''}
              </p>
            )}
          </div>
          <Badge variant="secondary">{s.subtask_type}</Badge>
          {campaign && <Badge variant="outline">{campaign.title}</Badge>}
        </div>

        <a href={s.proof_url || '#'} target="_blank" rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400 break-all block">
          {s.proof_url}
        </a>

        {s.proof_note && (
          <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground">
            Agent note: {s.proof_note}
          </div>
        )}

        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Checker note (required for reject/flag)" />
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleCheck('approved')} disabled={busy}>
            Approve ✅
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleCheck('rejected')} disabled={busy || !note.trim()}>
            Reject ✗
          </Button>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleCheck('flagged')} disabled={busy || !note.trim()}>
            Flag 🚩
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TAB: TEAM
// ============================================================

function TeamTab({ submissions, users }: { submissions: Submission[]; users: UserProfile[] }) {
  const agents = users.filter(u => u.socmedRole === 'Agent');

  const agentStats = useMemo(() => {
    return agents.map(a => {
      const subs = submissions.filter(s => s.agent_id === a.uid);
      const approved = subs.filter(s => s.status === 'approved').length;
      const submitted = subs.filter(s => s.status === 'submitted').length;
      const flagged = subs.filter(s => s.status === 'flagged').length;
      const rejected = subs.filter(s => s.status === 'rejected').length;
      const pending = subs.filter(s => s.status === 'pending').length;
      const total = subs.length;
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
      return { user: a, approved, submitted, flagged, rejected, pending, total, rate };
    });
  }, [agents, submissions]);

  const exportCsv = () => {
    const header = 'Name,Role,Total,Approved,Submitted,Flagged,Rejected,Pending,Approval Rate %';
    const rows = agentStats.map(a =>
      `"${a.user.displayName || ''}","Agent",${a.total},${a.approved},${a.submitted},${a.flagged},${a.rejected},${a.pending},${a.rate}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'socmed-team-report.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SectionLabel>Agent Performance</SectionLabel>
        <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState icon="👥" text="No agents found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agentStats.map(a => (
            <Card key={a.user.uid}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar name={a.user.displayName} size="lg" />
                  <div>
                    <p className="font-semibold text-sm">{a.user.displayName || a.user.email}</p>
                    <p className="text-xs text-muted-foreground">Total: {a.total} · Approval rate: {a.rate}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: 'Approved', val: a.approved, cls: 'text-green-600 dark:text-green-400' },
                    { label: 'Submitted', val: a.submitted, cls: 'text-yellow-600 dark:text-yellow-400' },
                    { label: 'Flagged', val: a.flagged, cls: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Rejected', val: a.rejected, cls: 'text-destructive' },
                    { label: 'Pending', val: a.pending, cls: 'text-muted-foreground' },
                  ].map(st => (
                    <div key={st.label} className="bg-muted rounded-lg px-1 py-2 text-center">
                      <p className={cn('text-base font-bold', st.cls)}>{st.val}</p>
                      <p className="text-[9px] uppercase text-muted-foreground">{st.label}</p>
                    </div>
                  ))}
                </div>

                <MiniBar value={a.rate} max={100} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: GROUPS (Admin + Manager)
// ============================================================

function GroupsTab({ groups, users, getToken }: {
  groups: SocmedGroup[]; users: UserProfile[]; getToken: () => Promise<string>;
}) {
  const agents = users.filter(u => u.socmedRole === 'Agent' && u.isActive);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setName(''); setDescription(''); setSelectedAgents(new Set()); setErrors({});
    setShowForm(true);
  };

  const openEdit = (g: SocmedGroup) => {
    setEditingId(g.id);
    setName(g.name); setDescription(g.description || '');
    setSelectedAgents(new Set(g.agentIds)); setErrors({});
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); };

  const toggleAgent = (uid: string) => {
    const next = new Set(selectedAgents);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    setSelectedAgents(next);
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true); setErrors({});
    const token = await getToken();
    const agentIds = Array.from(selectedAgents);

    const result = editingId
      ? await updateSocmedGroup(editingId, { name, description, agentIds }, token)
      : await createSocmedGroup(name, description, agentIds, token);

    setBusy(false);
    if (result.success) {
      cancelForm();
    } else {
      setErrors({ form: result.error || 'Failed to save group' });
    }
  };

  const handleDelete = async (g: SocmedGroup) => {
    if (!window.confirm(`Delete group "${g.name}"? This cannot be undone.`)) return;
    const token = await getToken();
    await deleteSocmedGroup(g.id, token);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SectionLabel>Agent Groups</SectionLabel>
        {!showForm && (
          <Button size="sm" onClick={openCreate}>+ New Group</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="font-medium text-sm">{editingId ? 'Edit Group' : 'New Group'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Group name" />
                <FieldError msg={errors.name} />
              </div>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Members</p>
              {agents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No active agents available.</p>
              ) : (
                <ScrollArea className="h-40 rounded-md border p-2">
                  <div className="space-y-2">
                    {agents.map(a => (
                      <label key={a.uid} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedAgents.has(a.uid)}
                          onCheckedChange={() => toggleAgent(a.uid)}
                        />
                        <UserAvatar name={a.displayName} size="sm" />
                        <span>{a.displayName || a.email}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            <FieldError msg={errors.form} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={cancelForm} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving...' : editingId ? 'Update Group' : 'Create Group'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && !showForm ? (
        <EmptyState icon="👥" text="No groups yet. Create one to speed up rollouts." />
      ) : (
        <div className="space-y-2">
          {groups.map(g => {
            const members = agents.filter(a => g.agentIds.includes(a.uid));
            const shown = members.slice(0, 5);
            const extra = members.length - shown.length;
            return (
              <Card key={g.id}>
                <CardContent className="pt-3 pb-3 flex items-start justify-between flex-wrap gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{g.name}</p>
                      <Badge variant="secondary" className="text-xs">{members.length} agent{members.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                    {members.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {shown.map(a => (
                          <span key={a.uid} className="inline-flex items-center gap-1 bg-muted rounded-full px-2 py-0.5 text-xs">
                            <UserAvatar name={a.displayName} size="sm" />
                            {a.displayName || a.email}
                          </span>
                        ))}
                        {extra > 0 && <span className="text-xs text-muted-foreground">+{extra} more</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(g)}>Edit</Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      onClick={() => handleDelete(g)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: USERS (Admin)
// ============================================================

function UsersTab({ users, getToken, refreshUsers, currentUid, socmedRole }: {
  users: UserProfile[]; getToken: () => Promise<string>; refreshUsers: () => Promise<void>;
  currentUid: string; socmedRole: SocmedRole;
}) {
  const canEdit = socmedRole === 'Admin' || socmedRole === 'Manager';
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<SocmedRole>('Agent');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    if (!password.trim()) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Min 6 characters';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true); setErrors({});
    const token = await getToken();
    const result = await createSocmedUser(name, email, password, role, token);
    setBusy(false);

    if (result.success) {
      setName(''); setEmail(''); setPassword(''); setShowForm(false);
      refreshUsers();
    } else {
      setErrors({ form: result.error || 'Failed' });
    }
  };

  const handleRoleChange = async (uid: string, newRole: string) => {
    const token = await getToken();
    await updateUserSocmedRole(uid, newRole || null, token);
    refreshUsers();
  };

  const handleRemove = async (uid: string) => {
    const token = await getToken();
    await removeSocmedUser(uid, token);
    refreshUsers();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SectionLabel>SocMed Users</SectionLabel>
        {canEdit && (
          <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add User'}
          </Button>
        )}
      </div>

      {canEdit && showForm && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
                <FieldError msg={errors.name} />
              </div>
              <div>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
                <FieldError msg={errors.email} />
              </div>
              <div>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
                <FieldError msg={errors.password} />
              </div>
              <AppSelect
                value={role}
                onChange={v => setRole(v as SocmedRole)}
                options={SOCMED_ROLES.map(r => ({ value: r, label: r }))}
              />
            </div>
            <FieldError msg={errors.form} />
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={busy}>{busy ? 'Creating...' : 'Create User'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {users.filter(u => u.isActive).map(u => {
          const isPrimary = u.roleId === 'platformAdmin';
          return (
            <Card key={u.uid}>
              <CardContent className="pt-3 pb-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <UserAvatar name={u.displayName} size="md" />
                  <div>
                    <p className="font-semibold text-sm">{u.displayName || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {u.roleId && <Badge variant="outline" className="text-xs">{u.roleId}</Badge>}
                  {u.socmedRole && <Badge className="text-xs">{u.socmedRole}</Badge>}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <AppSelect
                      value={u.socmedRole || ''}
                      onChange={v => handleRoleChange(u.uid, v)}
                      options={[{ value: '', label: 'No SocMed role' }, ...SOCMED_ROLES.map(r => ({ value: r, label: r }))]}
                      className="w-44"
                    />
                    {u.socmedRole && !isPrimary && u.uid !== currentUid && (
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={() => handleRemove(u.uid)}>
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  createCampaign,
  approveCampaign,
  rejectCampaign,
  rolloutCampaign,
  editRollout,
  deleteCampaign,
  updateCampaignDetails,
  markSubtaskDone,
  unmarkSubtaskDone,
  submitCampaignProof,
  checkSubtask,
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
  require_screenshot?: boolean;
  allow_multiple_urls?: boolean;
}

interface SubtaskItem {
  type: string;
  instruction: string;
  status: 'pending' | 'done' | 'passed' | 'failed';
  failure_reason: string | null;
  checked_by: string | null;
  checked_at: any;
}

interface Submission {
  id: string;
  campaign_id: string;
  agent_id: string;
  subtasks: SubtaskItem[];
  proof_urls: string[] | null;
  proof_screenshot_url: string | null;
  proof_note: string | null;
  submitted_at: any;
  overall_status: 'pending' | 'in_progress' | 'submitted' | 'passed' | 'failed';
}

type TabKey = 'dashboard' | 'campaigns' | 'tasks' | 'checkqueue' | 'groups' | 'team' | 'users';

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
  pending:     'bg-secondary text-secondary-foreground',
  in_progress: 'bg-blue-500/20 text-blue-700 border-blue-500/40 dark:text-blue-400',
  done:        'bg-blue-500/20 text-blue-700 border-blue-500/40 dark:text-blue-400',
  submitted:   'bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-400',
  passed:      'bg-green-500/20 text-green-700 border-green-500/40 dark:text-green-400',
  failed:      'bg-destructive/20 text-destructive border-destructive/40',
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
    { key: 'dashboard',  label: 'Dashboard',   roles: ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'] },
    { key: 'campaigns',  label: 'Campaigns',   roles: ['Admin', 'Manager', 'Validator', 'Checker', 'Agent'] },
    { key: 'tasks',      label: 'Tasks',       roles: ['Agent'] },
    { key: 'checkqueue', label: 'Check Queue', roles: ['Checker'] },
    { key: 'groups',     label: 'Groups',      roles: ['Admin', 'Manager'] },
    { key: 'team',       label: 'Team',        roles: ['Admin', 'Manager'] },
    { key: 'users',      label: 'Users',       roles: ['Admin', 'Manager', 'Validator'] },
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
              groups={groups}
              socmedRole={socmedRole}
              currentUid={user?.uid || ''}
              getToken={getToken}
            />
          )}
          {activeTab === 'tasks' && user && (
            <MyTasksTab
              campaigns={campaigns}
              submissions={submissions}
              currentUid={user.uid}
              getToken={getToken}
            />
          )}
          {activeTab === 'checkqueue' && user && (
            <CheckQueueTab
              campaigns={campaigns}
              submissions={submissions}
              users={allUsers}
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
  const toCheck = mySubs.filter(s => s.overall_status === 'submitted');
  const passed = mySubs.filter(s => s.overall_status === 'passed');

  const stats = isAgent
    ? [
      { label: 'My Active Campaigns', value: activeCampaigns.length,             color: 'text-green-600 dark:text-green-400' },
      { label: 'My Pending Tasks',     value: mySubs.filter(s => s.overall_status === 'pending' || s.overall_status === 'in_progress').length, color: 'text-yellow-600 dark:text-yellow-400' },
      { label: 'Awaiting Review',      value: toCheck.length,                    color: 'text-blue-600 dark:text-blue-400' },
      { label: 'My Tasks Passed',      value: passed.length,                     color: 'text-primary' },
    ]
    : [
      { label: 'Active Campaigns',     value: activeCampaigns.length,            color: 'text-green-600 dark:text-green-400' },
      { label: 'Pending Validation',   value: pendingValidation.length,          color: 'text-yellow-600 dark:text-yellow-400' },
      { label: 'Submissions to Check', value: toCheck.length,                    color: 'text-blue-600 dark:text-blue-400' },
      { label: 'Submissions Passed',   value: passed.length,                     color: 'text-primary' },
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
              const approvedCount = (isAgent ? mySubs : submissions)
                .filter(s => s.campaign_id === c.id)
                .reduce((sum, s) => sum + (s.subtasks?.filter(st => st.status === 'passed').length || 0), 0);
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

function CampaignsTab({ campaigns, submissions, users, groups, socmedRole, currentUid, getToken }: {
  campaigns: Campaign[]; submissions: Submission[]; users: UserProfile[]; groups: SocmedGroup[];
  socmedRole: SocmedRole; currentUid: string; getToken: () => Promise<string>;
}) {
  const isStaff = socmedRole === 'Admin' || socmedRole === 'Manager' || socmedRole === 'Validator';
  const canDelete = socmedRole === 'Admin' || socmedRole === 'Manager';
  const visibleCampaigns = isStaff
    ? campaigns
    : campaigns.filter(c =>
        c.submitted_by === currentUid ||
        c.status === 'validated' ||
        c.status === 'active' ||
        c.status === 'completed'
      );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rolloutSelectedId, setRolloutSelectedId] = useState<string | null>(null);
  const [rolloutMode, setRolloutMode] = useState<'create' | 'edit'>('create');
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleDelete = async (c: Campaign) => {
    if (!window.confirm(`Delete campaign "${c.title}"? This also removes all related submissions and cannot be undone.`)) return;
    setDeletingId(c.id);
    const token = await getToken();
    await deleteCampaign(c.id, token);
    setDeletingId(null);
    setDetailId(null);
  };

  // Staff: when a rollout configurator is open, take over the tab content.
  if (isStaff && rolloutSelectedId) {
    const campaign = campaigns.find(c => c.id === rolloutSelectedId);
    if (!campaign) {
      setRolloutSelectedId(null);
      return null;
    }
    return (
      <RolloutConfig
        campaign={campaign}
        users={users}
        groups={groups}
        getToken={getToken}
        mode={rolloutMode}
        onBack={() => setRolloutSelectedId(null)}
      />
    );
  }

  const pendingValidation = isStaff
    ? campaigns.filter(c => c.status === 'pending' || c.status === 'manager_approved')
    : [];
  const validatedAwaiting = isStaff ? campaigns.filter(c => c.status === 'validated') : [];
  const activeRollouts = isStaff ? campaigns.filter(c => c.status === 'active') : [];
  const rejectedCampaigns = isStaff ? campaigns.filter(c => c.status === 'rejected') : [];

  const detailCampaign = detailId ? campaigns.find(c => c.id === detailId) || null : null;
  const detailSubmission = detailCampaign
    ? submissions.find(s => s.campaign_id === detailCampaign.id && s.agent_id === currentUid) || null
    : null;

  const renderCampaignCard = (c: Campaign) => {
    const subtasks: SubtaskDef[] = parseJson(c.subtasks) || [];
    const agents: string[] = parseJson(c.target_agents) || [];
    const totalExpected = subtasks.length * agents.length;
    const approvedCount = submissions
      .filter(s => s.campaign_id === c.id)
      .reduce((sum, s) => sum + (s.subtasks?.filter(st => st.status === 'passed').length || 0), 0);

    return (
      <div key={c.id} className="relative">
        <button
          type="button"
          onClick={() => setDetailId(c.id)}
          className="block w-full text-left"
        >
          <Card className="hover:bg-accent/30 transition-colors">
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-center gap-2 pr-8">
                <span className="font-semibold text-sm truncate min-w-0 flex-1">{c.title}</span>
                <StatusBadge status={c.status} map={STATUS_CLASS} />
              </div>

              <p className="block text-xs text-blue-600 dark:text-blue-400 truncate">{c.url}</p>

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

              {c.status === 'active' && totalExpected > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{approvedCount}/{totalExpected}</span>
                  <MiniBar value={approvedCount} max={totalExpected} />
                </div>
              )}
            </CardContent>
          </Card>
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
            disabled={deletingId === c.id}
            title="Delete campaign"
            aria-label="Delete campaign"
            className="absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:pointer-events-none z-10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SectionLabel>Campaigns</SectionLabel>
        <Button size="sm" onClick={() => setCreateOpen(true)}>+ New Campaign</Button>
      </div>

      {isStaff ? (
        <>
          <section className="space-y-2">
            <SectionLabel>Pending Validation · {pendingValidation.length}</SectionLabel>
            {pendingValidation.length === 0 ? (
              <EmptyState icon="✅" text="No campaigns pending validation" />
            ) : (
              <div className="space-y-2">{pendingValidation.map(renderCampaignCard)}</div>
            )}
          </section>

          <section className="space-y-2">
            <SectionLabel>Validated · Awaiting Rollout · {validatedAwaiting.length}</SectionLabel>
            {validatedAwaiting.length === 0 ? (
              <EmptyState icon="🚀" text="No validated campaigns waiting for rollout" />
            ) : (
              <div className="space-y-2">{validatedAwaiting.map(renderCampaignCard)}</div>
            )}
          </section>

          <section className="space-y-2">
            <SectionLabel>Active Rollouts · {activeRollouts.length}</SectionLabel>
            {activeRollouts.length === 0 ? (
              <EmptyState icon="📡" text="No active rollouts yet" />
            ) : (
              <div className="space-y-2">{activeRollouts.map(renderCampaignCard)}</div>
            )}
          </section>

          <button
            type="button"
            onClick={() => setShowRejectedModal(true)}
            className="block w-full text-left"
            disabled={rejectedCampaigns.length === 0}
          >
            <Card className={cn(rejectedCampaigns.length === 0 ? 'opacity-60' : 'hover:bg-destructive/5')}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-destructive">Rejected</p>
                  <p className="text-xs text-muted-foreground">
                    {rejectedCampaigns.length === 0
                      ? 'No rejected campaigns'
                      : 'Click to view the rejection log'}
                  </p>
                </div>
                <span className="text-2xl font-bold text-destructive tabular-nums">{rejectedCampaigns.length}</span>
              </CardContent>
            </Card>
          </button>

          <RejectedCampaignsModal
            open={showRejectedModal}
            onOpenChange={setShowRejectedModal}
            rejected={rejectedCampaigns}
            users={users}
          />
        </>
      ) : (
        visibleCampaigns.length === 0 ? (
          <EmptyState icon="📋" text="No campaigns yet. Tap + New Campaign to submit one." />
        ) : (
          <div className="space-y-2">{visibleCampaigns.map(renderCampaignCard)}</div>
        )
      )}

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        getToken={getToken}
      />

      <CampaignDetailsModal
        campaign={detailCampaign}
        submission={detailSubmission}
        socmedRole={socmedRole}
        users={users}
        getToken={getToken}
        canDelete={canDelete}
        onClose={() => setDetailId(null)}
        onDelete={handleDelete}
        onConfigureRollout={(c) => { setDetailId(null); setRolloutMode('create'); setRolloutSelectedId(c.id); }}
        onEditRollout={(c) => { setDetailId(null); setRolloutMode('edit'); setRolloutSelectedId(c.id); }}
      />
    </div>
  );
}

function CreateCampaignDialog({ open, onOpenChange, getToken }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  getToken: () => Promise<string>;
}) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setTitle(''); setUrl(''); setDesc(''); setErrors({}); }
  }, [open]);

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
    if (result.success) onOpenChange(false);
    else setErrors({ form: result.error || 'Failed to submit' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Campaign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDetailsModal({ campaign, submission, socmedRole, users, getToken, canDelete, onClose, onDelete, onConfigureRollout, onEditRollout }: {
  campaign: Campaign | null;
  submission: Submission | null;
  socmedRole: SocmedRole;
  users: UserProfile[];
  getToken: () => Promise<string>;
  canDelete: boolean;
  onClose: () => void;
  onDelete: (c: Campaign) => void;
  onConfigureRollout: (c: Campaign) => void;
  onEditRollout: (c: Campaign) => void;
}) {
  const open = !!campaign;
  const isStaff = socmedRole === 'Admin' || socmedRole === 'Manager' || socmedRole === 'Validator';
  const isAgent = socmedRole === 'Agent';

  // Agent with an active assignment uses the focused task flow.
  const useTaskFlow =
    !!campaign && !!submission && isAgent &&
    campaign.status === 'active' && Array.isArray(submission.subtasks);

  if (useTaskFlow) {
    return (
      <TaskDetailModal
        submission={submission}
        campaign={campaign}
        onClose={onClose}
        getToken={getToken}
      />
    );
  }

  if (!open || !campaign) return null;

  return (
    <StaffCampaignDetail
      campaign={campaign}
      users={users}
      isStaff={isStaff}
      canDelete={canDelete}
      onClose={onClose}
      onDelete={onDelete}
      onConfigureRollout={onConfigureRollout}
      onEditRollout={onEditRollout}
      getToken={getToken}
    />
  );
}

function StaffCampaignDetail({ campaign: c, users, isStaff, canDelete, onClose, onDelete, onConfigureRollout, onEditRollout, getToken }: {
  campaign: Campaign;
  users: UserProfile[];
  isStaff: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDelete: (c: Campaign) => void;
  onConfigureRollout: (c: Campaign) => void;
  onEditRollout: (c: Campaign) => void;
  getToken: () => Promise<string>;
}) {
  const [editTitle, setEditTitle] = useState(c.title);
  const [editUrl, setEditUrl] = useState(c.url);
  const [editDesc, setEditDesc] = useState(c.description || '');
  const [validationNote, setValidationNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Reseed when a different campaign is opened.
  useEffect(() => {
    setEditTitle(c.title);
    setEditUrl(c.url);
    setEditDesc(c.description || '');
    setValidationNote('');
    setRejectReason('');
    setError(''); setInfo('');
  }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = editTitle !== c.title || editUrl !== c.url || editDesc !== (c.description || '');

  const handleSave = async () => {
    setError(''); setInfo('');
    setBusy('save');
    const token = await getToken();
    const result = await updateCampaignDetails(
      c.id,
      { title: editTitle, url: editUrl, description: editDesc },
      token,
    );
    setBusy(null);
    if (!result.success) setError(result.error || 'Failed to save changes.');
    else setInfo('Saved.');
  };

  const handleValidate = async () => {
    setError(''); setInfo('');
    setBusy('validate');
    const token = await getToken();
    const result = await approveCampaign(c.id, validationNote, token);
    setBusy(null);
    if (!result.success) setError(result.error || 'Failed to validate.');
    else { setInfo('Campaign validated.'); setValidationNote(''); }
  };

  const handleReject = async () => {
    setError(''); setInfo('');
    if (!rejectReason.trim()) { setError('Rejection reason is required.'); return; }
    setBusy('reject');
    const token = await getToken();
    const result = await rejectCampaign(c.id, rejectReason, token);
    setBusy(null);
    if (!result.success) setError(result.error || 'Failed to reject.');
    else { setInfo('Campaign rejected.'); setRejectReason(''); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-start gap-2 pr-6">
            <DialogTitle className="text-base flex-1 min-w-0 truncate">
              {isStaff ? 'Campaign Details' : c.title}
            </DialogTitle>
            <StatusBadge status={c.status} map={STATUS_CLASS} />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">
            {isStaff ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Title</p>
                  <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Facebook Post URL</p>
                  <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Description</p>
                  <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
                </div>
              </>
            ) : (
              <>
                {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                <a href={c.url} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-blue-600 hover:underline dark:text-blue-400 break-all">{c.url}</a>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={editUrl || c.url} target="_blank" rel="noopener noreferrer">Go to Link →</a>
              </Button>
              {c.deadline && (
                <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/40 dark:text-yellow-400">
                  Due {c.deadline}
                </Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
              <UserAvatar name={getUserName(c.submitted_by, users)} size="sm" />
              <span>Submitted by {getUserName(c.submitted_by, users)}</span>
              <span className="text-muted-foreground/60">· {c.submitted_at}</span>
              {c.validator_approved_by && (
                <span>· validated by {getUserName(c.validator_approved_by, users)}</span>
              )}
            </div>

            {c.status === 'rejected' && c.rejection_reason && (
              <div className="bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-xs text-destructive">
                <p className="font-semibold">Rejected</p>
                <p>{c.rejection_reason}</p>
                {c.rejected_by && (
                  <p className="text-muted-foreground mt-1">by {getUserName(c.rejected_by, users)}</p>
                )}
              </div>
            )}

            {isStaff && (c.status === 'pending' || c.status === 'manager_approved') && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Validation</p>
                <Textarea
                  value={validationNote}
                  onChange={e => setValidationNote(e.target.value)}
                  placeholder="Validation note (optional)"
                  rows={2}
                />
                <Input
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (required to reject)"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleValidate}
                    disabled={busy === 'validate'}
                  >
                    {busy === 'validate' ? 'Validating...' : 'Validate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={busy === 'reject' || !rejectReason.trim()}
                  >
                    {busy === 'reject' ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            )}

            {isStaff && c.status === 'validated' && (
              <div className="border-t pt-3">
                <Button size="sm" onClick={() => onConfigureRollout(c)}>
                  Configure Rollout →
                </Button>
              </div>
            )}

            {isStaff && c.status === 'active' && (
              <div className="border-t pt-3">
                <Button size="sm" variant="outline" onClick={() => onEditRollout(c)}>
                  Edit Rollout →
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {(error || info || (isStaff && dirty) || canDelete) && (
          <div className="border-t p-3 space-y-2 bg-muted/20">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {info && !error && <p className="text-xs text-green-700 dark:text-green-400">{info}</p>}
            <div className="flex gap-2 justify-end">
              {canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10 mr-auto"
                  onClick={() => onDelete(c)}
                >
                  Delete
                </Button>
              )}
              {isStaff && (
                <Button size="sm" onClick={handleSave} disabled={!dirty || busy === 'save'}>
                  {busy === 'save' ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RejectedCampaignsModal({ open, onOpenChange, rejected, users }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rejected: Campaign[];
  users: UserProfile[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rejected Campaigns ({rejected.length})</DialogTitle>
        </DialogHeader>
        {rejected.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rejected campaigns.</p>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead>Rejected by</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejected.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="align-top">
                      <p className="font-medium text-sm">{c.title}</p>
                      <a href={c.url} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-blue-600 hover:underline dark:text-blue-400 truncate max-w-[14rem]">{c.url}</a>
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {getUserName(c.submitted_by, users)}
                      <span className="block text-muted-foreground/60">{c.submitted_at}</span>
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {c.rejected_by ? getUserName(c.rejected_by, users) : '—'}
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      {c.rejection_reason || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// ROLLOUT CONFIG (used inside CampaignsTab when Configure/Edit is clicked)
// ============================================================

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
  const [requireScreenshot, setRequireScreenshot] = useState<boolean>(
    isEdit ? (campaign.require_screenshot !== false) : true
  );
  const [allowMultipleUrls, setAllowMultipleUrls] = useState<boolean>(
    isEdit ? (campaign.allow_multiple_urls !== false) : true
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
    const args = [
      campaign.id,
      subtasks,
      Array.from(selectedAgents),
      deadline,
      requireScreenshot,
      allowMultipleUrls,
      token,
    ] as const;
    const result = isEdit ? await editRollout(...args) : await rolloutCampaign(...args);
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

      <Card>
        <CardContent className="pt-4 space-y-2">
          <SectionLabel>Proof Requirements</SectionLabel>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={requireScreenshot}
              onCheckedChange={v => setRequireScreenshot(!!v)}
            />
            <span>Require screenshot URL</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={allowMultipleUrls}
              onCheckedChange={v => setAllowMultipleUrls(!!v)}
            />
            <span>Allow multiple proof URLs (otherwise exactly one URL accepted)</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Each agent provides proof once per campaign — one screenshot (if required) and one or many URLs depending on this setting.
          </p>
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
  const activeCampaignsById = useMemo(() => {
    const m = new Map<string, Campaign>();
    for (const c of campaigns) if (c.status === 'active') m.set(c.id, c);
    return m;
  }, [campaigns]);

  const myActive = submissions.filter(s =>
    s.agent_id === currentUid &&
    Array.isArray(s.subtasks) &&
    activeCampaignsById.has(s.campaign_id)
  );

  const [openId, setOpenId] = useState<string | null>(null);
  const openSubmission = openId ? (myActive.find(s => s.id === openId) || null) : null;
  const openCampaign = openSubmission ? (activeCampaignsById.get(openSubmission.campaign_id) || null) : null;

  if (myActive.length === 0) {
    return <EmptyState icon="📝" text="No active tasks assigned to you" />;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {myActive.map(s => {
          const c = activeCampaignsById.get(s.campaign_id)!;
          const total = s.subtasks.length;
          const passedCount = s.subtasks.filter(st => st.status === 'passed').length;
          const doneCount = s.subtasks.filter(st => st.status !== 'pending').length;
          const failedCount = s.subtasks.filter(st => st.status === 'failed').length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenId(s.id)}
              className="text-left"
            >
              <Card className="hover:bg-accent/30 transition-colors h-full">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <p className="font-semibold text-sm truncate flex-1 min-w-0">{c.title}</p>
                    <StatusBadge status={s.overall_status} map={SUB_STATUS_CLASS} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{c.url}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      {passedCount}/{total} passed
                    </span>
                    {failedCount > 0 && (
                      <span className="text-destructive tabular-nums">· {failedCount} failed</span>
                    )}
                    <span className="text-muted-foreground/70 tabular-nums ml-auto">
                      {doneCount}/{total} done
                    </span>
                  </div>
                  <MiniBar value={passedCount} max={total} />
                  {c.deadline && (
                    <p className="text-[10px] text-yellow-700 dark:text-yellow-400">Due {c.deadline}</p>
                  )}
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <TaskDetailModal
        submission={openSubmission}
        campaign={openCampaign}
        onClose={() => setOpenId(null)}
        getToken={getToken}
      />
    </>
  );
}

function TaskDetailModal({ submission, campaign, onClose, getToken }: {
  submission: Submission | null;
  campaign: Campaign | null;
  onClose: () => void;
  getToken: () => Promise<string>;
}) {
  const open = !!(submission && campaign);

  // Local proof draft — re-seeded each time the modal opens.
  const [urls, setUrls] = useState<string[]>(['']);
  const [screenshot, setScreenshot] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (open && submission) {
      setUrls(submission.proof_urls && submission.proof_urls.length > 0 ? [...submission.proof_urls] : ['']);
      setScreenshot(submission.proof_screenshot_url || '');
      setNote(submission.proof_note || '');
      setError(''); setInfo('');
    }
  }, [open, submission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !submission || !campaign) return null;

  const requireScreenshot = campaign.require_screenshot !== false;
  const allowMultipleUrls = campaign.allow_multiple_urls !== false;

  const handleToggleSubtask = async (st: SubtaskItem) => {
    if (st.status === 'passed' || st.status === 'failed') return;
    setBusy(st.type); setError(''); setInfo('');
    const token = await getToken();
    const result = st.status === 'pending'
      ? await markSubtaskDone(submission.id, st.type, token)
      : await unmarkSubtaskDone(submission.id, st.type, token);
    setBusy(null);
    if (!result.success) setError(result.error || 'Failed');
    else setInfo(st.status === 'pending' ? 'Sent to checker.' : 'Subtask reverted to pending.');
  };

  const handleSaveProof = async () => {
    setError(''); setInfo('');
    const cleanUrls = urls.map(u => u.trim()).filter(Boolean);
    if (cleanUrls.length === 0) { setError('At least one proof URL is required.'); return; }
    if (!allowMultipleUrls && cleanUrls.length > 1) { setError('Only one URL is allowed for this campaign.'); return; }
    if (requireScreenshot && !screenshot.trim()) { setError('Screenshot URL is required.'); return; }

    setBusy('save');
    const token = await getToken();
    const result = await submitCampaignProof(submission.id, cleanUrls, screenshot.trim() || null, note.trim(), token);
    setBusy(null);
    if (!result.success) setError(result.error || 'Failed to save proof.');
    else setInfo('Proof saved.');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-start gap-2 pr-6">
            <DialogTitle className="text-base flex-1 min-w-0 truncate">{campaign.title}</DialogTitle>
            <StatusBadge status={submission.overall_status} map={SUB_STATUS_CLASS} />
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">
            <div className="space-y-1.5">
              {campaign.description && (
                <p className="text-sm text-muted-foreground">{campaign.description}</p>
              )}
              <a href={campaign.url} target="_blank" rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:underline dark:text-blue-400 break-all">{campaign.url}</a>
              {campaign.deadline && (
                <p className="text-xs text-yellow-700 dark:text-yellow-400">Deadline: {campaign.deadline}</p>
              )}
              <Button asChild size="sm" variant="outline">
                <a href={campaign.url} target="_blank" rel="noopener noreferrer">Go to Link →</a>
              </Button>
            </div>

            <div>
              <SectionLabel>Subtasks</SectionLabel>
              <p className="text-xs text-muted-foreground mb-2">
                Each subtask is forwarded to the checker as soon as you mark it done.
              </p>
              <div className="space-y-1.5">
                {submission.subtasks.map(st => {
                  const checked = st.status !== 'pending';
                  const graded = st.status === 'passed' || st.status === 'failed';
                  return (
                    <div key={st.type} className="flex items-start gap-2 bg-muted rounded px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(st)}
                        disabled={graded || busy === st.type}
                        className={cn(
                          'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border shrink-0',
                          checked
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-input',
                          graded && 'opacity-60 cursor-not-allowed',
                        )}
                        aria-label={checked ? 'Unmark done' : 'Mark done'}
                      >
                        {checked ? '✓' : ''}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="mr-1">{SUBTASK_ICONS[st.type] || ''}</span>
                          <span className="font-medium">{st.type}</span>
                          {st.instruction && <span className="text-muted-foreground">: {st.instruction}</span>}
                        </p>
                        {st.status === 'failed' && st.failure_reason && (
                          <p className="text-xs text-destructive mt-0.5">Failed: {st.failure_reason}</p>
                        )}
                        {st.status === 'passed' && (
                          <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">Passed by checker</p>
                        )}
                      </div>
                      <StatusBadge status={st.status} map={SUB_STATUS_CLASS} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t p-4 space-y-2 bg-muted/20">
          <SectionLabel>Proof</SectionLabel>
          <Input
            value={screenshot}
            onChange={e => setScreenshot(e.target.value)}
            placeholder={requireScreenshot ? 'Screenshot URL (required)' : 'Screenshot URL (optional)'}
          />
          <div className="space-y-1.5">
            {urls.map((u, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={u}
                  onChange={e => setUrls(urls.map((x, idx) => idx === i ? e.target.value : x))}
                  placeholder={i === 0 ? 'Proof URL (required)' : 'Additional URL'}
                />
                {urls.length > 1 && (
                  <Button size="icon" variant="ghost" className="shrink-0"
                    onClick={() => setUrls(urls.filter((_, idx) => idx !== i))}>
                    <span aria-hidden>×</span>
                  </Button>
                )}
              </div>
            ))}
            {allowMultipleUrls && (
              <Button size="sm" variant="outline" onClick={() => setUrls([...urls, ''])}>
                + Add URL
              </Button>
            )}
          </div>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && !error && <p className="text-xs text-green-700 dark:text-green-400">{info}</p>}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveProof}
              disabled={busy === 'save'}
              className="bg-green-600 hover:bg-green-700"
            >
              {busy === 'save' ? 'Saving...' : 'Save Proof'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TAB: CHECK QUEUE (Checker)
// ============================================================

function CheckQueueTab({ submissions, campaigns, users, currentUid: _currentUid, getToken }: {
  submissions: Submission[]; campaigns: Campaign[]; users: UserProfile[]; currentUid: string; getToken: () => Promise<string>;
}) {
  const toCheck = submissions.filter(s =>
    Array.isArray(s.subtasks) &&
    (s.overall_status === 'submitted' || s.subtasks.some(st => st.status === 'done'))
  );

  return (
    <div className="space-y-3">
      <SectionLabel>Submissions to Review</SectionLabel>
      {toCheck.length === 0 ? (
        <EmptyState icon="🔍" text="No submissions to check right now" />
      ) : (
        <div className="space-y-3">
          {toCheck.map(s => {
            const campaign = campaigns.find(c => c.id === s.campaign_id);
            if (!campaign) return null;
            return <CheckCard key={s.id} submission={s} campaign={campaign} users={users} getToken={getToken} />;
          })}
        </div>
      )}
    </div>
  );
}

function CheckCard({ submission: s, campaign: c, users, getToken }: {
  submission: Submission; campaign: Campaign; users: UserProfile[]; getToken: () => Promise<string>;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleGrade = async (st: SubtaskItem, newStatus: 'passed' | 'failed') => {
    setError('');
    if (newStatus === 'failed' && !(reasons[st.type] || '').trim()) {
      setError('Failure reason is required to mark this subtask failed.');
      return;
    }
    setBusy(st.type);
    const token = await getToken();
    const result = await checkSubtask(s.id, st.type, newStatus, reasons[st.type] || '', token);
    setBusy(null);
    if (!result.success) setError(result.error || 'Failed');
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <UserAvatar name={getUserName(s.agent_id, users)} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{getUserName(s.agent_id, users)}</p>
            <p className="text-xs text-muted-foreground truncate">{c.title}</p>
          </div>
          <StatusBadge status={s.overall_status} map={SUB_STATUS_CLASS} />
        </div>

        <div className="bg-muted rounded p-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Proof</p>
          {(s.proof_urls || []).map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noopener noreferrer"
              className="block text-xs text-blue-600 hover:underline dark:text-blue-400 truncate">{u}</a>
          ))}
          {s.proof_screenshot_url && (
            <a href={s.proof_screenshot_url} target="_blank" rel="noopener noreferrer"
              className="block text-xs text-blue-600 hover:underline dark:text-blue-400 truncate">📷 {s.proof_screenshot_url}</a>
          )}
          {s.proof_note && <p className="text-xs text-muted-foreground">Note: {s.proof_note}</p>}
        </div>

        <div className="space-y-2">
          {s.subtasks.map(st => {
            const graded = st.status === 'passed' || st.status === 'failed';
            return (
              <div key={st.type} className="rounded border bg-background p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    <span className="mr-1">{SUBTASK_ICONS[st.type] || ''}</span>
                    <span className="font-medium">{st.type}</span>
                    {st.instruction && <span className="text-muted-foreground">: {st.instruction}</span>}
                  </span>
                  <StatusBadge status={st.status} map={SUB_STATUS_CLASS} />
                </div>
                {st.status === 'failed' && st.failure_reason && (
                  <p className="text-xs text-destructive">Reason: {st.failure_reason}</p>
                )}
                {!graded && (
                  <>
                    <Input
                      value={reasons[st.type] || ''}
                      onChange={e => setReasons({ ...reasons, [st.type]: e.target.value })}
                      placeholder="Failure reason (required to fail)"
                      className="text-xs h-8"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleGrade(st, 'passed')}
                        disabled={busy === st.type}>
                        Pass
                      </Button>
                      <Button size="sm" variant="destructive"
                        onClick={() => handleGrade(st, 'failed')}
                        disabled={busy === st.type || !(reasons[st.type] || '').trim()}>
                        Fail
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
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
      const subs = submissions.filter(s => s.agent_id === a.uid && Array.isArray(s.subtasks));
      let passed = 0, failed = 0, awaitingReview = 0, doneAwaitingProof = 0, pending = 0, total = 0;
      for (const s of subs) {
        for (const st of s.subtasks) {
          total += 1;
          if (st.status === 'passed') passed += 1;
          else if (st.status === 'failed') failed += 1;
          else if (st.status === 'done' && s.submitted_at) awaitingReview += 1;
          else if (st.status === 'done') doneAwaitingProof += 1;
          else pending += 1;
        }
      }
      const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
      return { user: a, passed, failed, awaitingReview, doneAwaitingProof, pending, total, rate };
    });
  }, [agents, submissions]);

  const exportCsv = () => {
    const header = 'Name,Role,Total Subtasks,Passed,Failed,Awaiting Review,Done Awaiting Proof,Pending,Pass Rate %';
    const rows = agentStats.map(a =>
      `"${a.user.displayName || ''}","Agent",${a.total},${a.passed},${a.failed},${a.awaitingReview},${a.doneAwaitingProof},${a.pending},${a.rate}`
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
                    <p className="text-xs text-muted-foreground">Total subtasks: {a.total} · Pass rate: {a.rate}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: 'Passed',  val: a.passed,            cls: 'text-green-600 dark:text-green-400' },
                    { label: 'Failed',  val: a.failed,            cls: 'text-destructive' },
                    { label: 'Review',  val: a.awaitingReview,    cls: 'text-yellow-600 dark:text-yellow-400' },
                    { label: 'Done',    val: a.doneAwaitingProof, cls: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Pending', val: a.pending,           cls: 'text-muted-foreground' },
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

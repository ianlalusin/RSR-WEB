'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Users,
  Landmark,
  ClipboardList,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { canViewPage } from '@/lib/access';
import { getDashboardData, type DashboardData } from '@/app/actions';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const compactNumber = new Intl.NumberFormat('en-PH');

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function StatCard({
  title,
  value,
  caption,
  icon,
  loading,
  href,
}: {
  title: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  loading: boolean;
  href?: string;
}) {
  const card = (
    <Card className={href ? 'h-full transition-colors hover:border-primary/50 hover:bg-muted/50' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  );
}

function Dashboard() {
  const { userProfile, user, isPlatformAdminClaim } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canView = canViewPage(userProfile, 'dashboard', { isPlatformAdminClaim });
  const linkIfAllowed = (page: Parameters<typeof canViewPage>[1], href: string) =>
    canViewPage(userProfile, page, { isPlatformAdminClaim }) ? href : undefined;

  const load = useCallback(async () => {
    if (!canView || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await getDashboardData(token);
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [canView, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!canView) {
    return <AccessDenied />;
  }

  return (
    <div className="grid gap-6">
      {error && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Barangays"
          value={data ? compactNumber.format(data.totalBarangays) : '—'}
          caption="Registered barangays"
          icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          href={linkIfAllowed('barangays_list', '/barangays')}
        />
        <StatCard
          title="Total Coordinators"
          value={data ? compactNumber.format(data.totalCoordinators) : '—'}
          caption="Active coordinator accounts"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          href={linkIfAllowed('admin_users', '/admin/users')}
        />
        <StatCard
          title="Assistance Records"
          value={data ? compactNumber.format(data.assistanceRecords) : '—'}
          caption="Medical + project records"
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          href={linkIfAllowed('projects_medical', '/medical')}
        />
        <StatCard
          title="Total Disbursed"
          value={data ? peso.format(data.totalDisbursed) : '—'}
          caption="Value released across projects"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Value Disbursed by District</CardTitle>
            <CardDescription>Total assistance value released per district.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data && data.districts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={data.districts}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₱${(Number(value) / 1000).toLocaleString()}K`}
                  />
                  <Tooltip
                    formatter={(value: number) => [peso.format(Number(value)), 'Disbursed']}
                    labelClassName="text-foreground"
                  />
                  <Bar dataKey="value" name="Disbursed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No project records yet.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>A log of recent platform events.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : data && data.recentActivity.length > 0 ? (
              <Table>
                <TableBody>
                  {data.recentActivity.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="font-medium">{activity.type}</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">
                          {activity.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {timeAgo(activity.atMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent activity.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessDenied() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
                <p>You do not have permission to view this page. Please contact a Platform Administrator if you believe this is an error.</p>
            </CardContent>
        </Card>
    );
}


// Auth gating and the app shell (AppLayout) are handled by the (app) route
// group's ProtectedLayout, so this page just renders the dashboard content —
// matching the sibling pages (barangays, medical, etc.).
export default function DashboardPage() {
  return <Dashboard />;
}

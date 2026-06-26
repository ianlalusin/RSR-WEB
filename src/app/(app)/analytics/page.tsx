'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Landmark, Briefcase, FolderKanban, AlertTriangle } from 'lucide-react';
import type { AnalyticsData } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import { getAnalyticsData, type AnalyticsPeriod } from '@/app/actions';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
    daily: "Today's",
    weekly: 'Past week',
    yearly: 'This year',
};

function StatCard({
    title,
    value,
    icon,
    loading,
}: {
    title: string;
    value: number | undefined;
    icon: React.ReactNode;
    loading: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading || value === undefined ? (
                    <Skeleton className="h-8 w-16" />
                ) : (
                    <div className="text-2xl font-bold">{value.toLocaleString()}</div>
                )}
            </CardContent>
        </Card>
    );
}

function AnalyticsDashboard({
    data,
    period,
    loading,
}: {
    data?: AnalyticsData;
    period: AnalyticsPeriod;
    loading: boolean;
}) {
    return (
        <div className="grid gap-6 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Brgys w/ Profile"
                    value={data?.brgyWithProfileCount}
                    icon={<Landmark className="h-4 w-4 text-muted-foreground" />}
                    loading={loading}
                />
                <StatCard
                    title="Active Users"
                    value={data?.userCount}
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                    loading={loading}
                />
                <StatCard
                    title="Departments"
                    value={data?.departmentCount}
                    icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
                    loading={loading}
                />
                <StatCard
                    title={`Projects (${PERIOD_LABELS[period]})`}
                    value={data?.projectCount}
                    icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
                    loading={loading}
                />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Members per Department</CardTitle>
                    <CardDescription>Active staff across departments (current totals).</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading || !data ? (
                        <Skeleton className="h-[300px] w-full" />
                    ) : data.departments.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <RechartsBarChart data={data.departments}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="memberCount" name="Members" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                            No departments yet.
                        </div>
                    )}
                </CardContent>
            </Card>
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
          <p>You do not have permission to view this page.</p>
        </CardContent>
      </Card>
    );
}

export default function AnalyticsPage() {
    const { userProfile, user, isPlatformAdminClaim } = useAuth();
    const canView = canViewPage(userProfile, 'analytics', { isPlatformAdminClaim });

    const [period, setPeriod] = useState<AnalyticsPeriod>('weekly');
    const [byPeriod, setByPeriod] = useState<Partial<Record<AnalyticsPeriod, AnalyticsData>>>({});
    const [loadingPeriod, setLoadingPeriod] = useState<AnalyticsPeriod | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (p: AnalyticsPeriod) => {
            if (!canView || !user) return;
            setLoadingPeriod(p);
            setError(null);
            try {
                const token = await user.getIdToken();
                const res = await getAnalyticsData(token, p);
                if (res.success) {
                    setByPeriod((prev) => ({ ...prev, [p]: res.data }));
                } else {
                    setError(res.error);
                }
            } catch (e: any) {
                setError(e?.message ?? 'Failed to load analytics data.');
            } finally {
                setLoadingPeriod((cur) => (cur === p ? null : cur));
            }
        },
        [canView, user],
    );

    useEffect(() => {
        if (canView && user && !byPeriod[period]) {
            load(period);
        }
    }, [canView, user, period, byPeriod, load]);

    if (!canView) {
        return <AccessDenied />;
    }

    return (
        <div className="space-y-6">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)} className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
                        <p className="text-muted-foreground">
                            An overview of platform activity.
                        </p>
                    </div>
                    <TabsList>
                        <TabsTrigger value="daily">Daily</TabsTrigger>
                        <TabsTrigger value="weekly">Weekly</TabsTrigger>
                        <TabsTrigger value="yearly">Yearly</TabsTrigger>
                    </TabsList>
                </div>
            </Tabs>

            {error && (
                <Card className="border-destructive">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base text-destructive">
                            <AlertTriangle className="h-4 w-4" /> Couldn&apos;t load analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
                </Card>
            )}

            <AnalyticsDashboard
                data={byPeriod[period]}
                period={period}
                loading={loadingPeriod === period || !byPeriod[period]}
            />
        </div>
    );
}

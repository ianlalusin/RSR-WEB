'use client';

import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Landmark, Briefcase, FolderKanban, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AnalyticsData } from '@/lib/types';


const MOCK_DATA: Record<string, AnalyticsData> = {
    daily: {
        brgyWithProfileCount: 52,
        userCount: 15,
        departmentCount: 4,
        projectCount: 128,
        departments: [
            { name: 'Finance', memberCount: 5 },
            { name: 'Operations', memberCount: 12 },
            { name: 'Marketing', memberCount: 3 },
            { name: 'Field Staff', memberCount: 25 },
        ],
    },
    weekly: {
        brgyWithProfileCount: 50,
        userCount: 14,
        departmentCount: 4,
        projectCount: 110,
        departments: [
            { name: 'Finance', memberCount: 5 },
            { name: 'Operations', memberCount: 11 },
            { name: 'Marketing', memberCount: 3 },
            { name: 'Field Staff', memberCount: 22 },
        ],
    },
    yearly: {
        brgyWithProfileCount: 35,
        userCount: 10,
        departmentCount: 3,
        projectCount: 540,
        departments: [
            { name: 'Finance', memberCount: 4 },
            { name: 'Operations', memberCount: 8 },
            { name: 'Marketing', memberCount: 2 },
            { name: 'Field Staff', memberCount: 15 },
        ],
    },
}

function AnalyticsDashboard({ data, period }: { data: AnalyticsData, period: string }) {
    return (
        <div className="grid gap-6 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Brgys w/ Profile</CardTitle>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.brgyWithProfileCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.userCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Departments</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.departmentCount}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projects</CardTitle>
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.projectCount}</div>
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Members per Department</CardTitle>
                    <CardDescription>{period} breakdown of staff across departments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <RechartsBarChart data={data.departments}>
                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="memberCount" name="Members" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </RechartsBarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}

export default function AnalyticsPage() {
    return (
        <div className="space-y-6">
            <Tabs defaultValue="weekly" className="w-full">
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
                <TabsContent value="daily">
                    <AnalyticsDashboard data={MOCK_DATA.daily} period="Today's" />
                </TabsContent>
                <TabsContent value="weekly">
                    <AnalyticsDashboard data={MOCK_DATA.weekly} period="This week's" />
                </TabsContent>
                <TabsContent value="yearly">
                    <AnalyticsDashboard data={MOCK_DATA.yearly} period="This year's" />
                </TabsContent>
            </Tabs>
            <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Developer Note</AlertTitle>
                <AlertDescription>
                    This page currently uses mock data. To make it dynamic, you'll need to implement a backend process (like a Firebase Cloud Function) to periodically generate and store analytics snapshots in the `analytics` collection in Firestore.
                </AlertDescription>
            </Alert>
        </div>
    );
}
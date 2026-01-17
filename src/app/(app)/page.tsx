import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  BarChart,
  Users,
  Landmark,
  ClipboardList,
  DollarSign,
  Activity,
} from 'lucide-react';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const sectorData = [
  { name: 'Medical', value: 450, fill: "hsl(var(--chart-1))" },
  { name: 'Education', value: 300, fill: "hsl(var(--chart-2))" },
  { name: 'Infra', value: 200, fill: "hsl(var(--chart-3))" },
  { name: 'Other', value: 278, fill: "hsl(var(--chart-4))" },
];

const districtData = [
    { name: 'North', budget: 4000, expenses: 2400 },
    { name: 'South', budget: 3000, expenses: 1398 },
    { name: 'East', budget: 2000, expenses: 7800 },
    { name: 'West', budget: 2780, expenses: 3908 },
    { name: 'Urban', budget: 1890, expenses: 4800 },
];

const recentActivity = [
    { type: 'Assistance', description: 'Medical aid for Brgy. 101', time: '15m ago' },
    { type: 'Report', description: 'Coordinator report from J. Cruz', time: '1h ago' },
    { type: 'Budget', description: 'Expense approved for office supplies', time: '3h ago' },
    { type: 'Visit', description: 'Cong. visit to Brgy. 24', time: 'yesterday' },
    { type: 'User', description: 'New coordinator added: M. Reyes', time: 'yesterday' },
]

export default function Dashboard() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Barangays
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">177</div>
            <p className="text-xs text-muted-foreground">+2 since last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Coordinators
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">235</div>
            <p className="text-xs text-muted-foreground">+5 this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assistance Records</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,234</div>
            <p className="text-xs text-muted-foreground">+19% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">78%</div>
            <p className="text-xs text-muted-foreground">P1.2M remaining</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>District Performance</CardTitle>
            <CardDescription>Budget vs. Expenses Overview</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
             <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={districtData}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}K`}/>
                    <Tooltip />
                    <Bar dataKey="budget" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>A log of recent platform events.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {recentActivity.map((activity, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="font-medium">{activity.type}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">
                        {activity.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{activity.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

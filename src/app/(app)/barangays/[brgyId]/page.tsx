import { mockBarangays } from '@/lib/data';
import { Barangay } from '@/lib/types';
import { notFound } from 'next/navigation';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Vote, HandCoins, Building, GraduationCap, HeartPulse } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GenerateProfilesDialog from './_components/generate-profiles-dialog';


async function getBarangay(id: string): Promise<Barangay | undefined> {
  // In a real app, fetch from Firestore
  return mockBarangay_s.find((b) => b.id === id);
}

export default async function BarangayDetailPage({ params }: { params: { brgyId: string } }) {
  const barangay = await getBarangay(params.brgyId);

  if (!barangay) {
    notFound();
  }

  return (
    <div className="grid gap-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-bold">{barangay.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-2">
                            <span>{barangay.districtName}</span>
                            <Badge variant={barangay.isWin ? 'default' : 'secondary'} className={barangay.isWin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {barangay.isWin ? 'Win' : 'Lose'}
                            </Badge>
                        </CardDescription>
                    </div>
                    <GenerateProfilesDialog barangay={barangay} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.population.toLocaleString()}</p>
                            <p className="text-muted-foreground">Population</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Vote className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.votingPopulation.toLocaleString()}</p>
                            <p className="text-muted-foreground">Voting Population</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <HandCoins className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.favoredVotePct}%</p>
                            <p className="text-muted-foreground">Favored Vote</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold">{barangay.coordinatorUids.length}</p>
                            <p className="text-muted-foreground">Coordinators</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Tabs defaultValue="medical">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="medical"><HeartPulse className="w-4 h-4 mr-2"/>Medical</TabsTrigger>
                <TabsTrigger value="educational"><GraduationCap className="w-4 h-4 mr-2"/>Educational</TabsTrigger>
                <TabsTrigger value="infrastructure"><Building className="w-4 h-4 mr-2"/>Infrastructure</TabsTrigger>
            </TabsList>
            <TabsContent value="medical">
                <Card>
                    <CardHeader>
                        <CardTitle>Medical Assistance</CardTitle>
                        <CardDescription>Records of medical assistance provided to this barangay.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <p>Medical assistance records will be displayed here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="educational">
                <Card>
                    <CardHeader>
                        <CardTitle>Educational Assistance</CardTitle>
                        <CardDescription>Records of educational assistance provided to this barangay.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <p>Educational assistance records will be displayed here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="infrastructure">
                <Card>
                    <CardHeader>
                        <CardTitle>Infrastructure Projects</CardTitle>
                        <CardDescription>Records of infrastructure projects in this barangay.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <p>Infrastructure project records will be displayed here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Landmark } from 'lucide-react';
import { createUserWithEmailAndPassword, UserCredential } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { platformAdminAccess } from '@/lib/access';
import { UserProfile } from '@/lib/types';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'Please check your credentials and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Google Login Failed',
        description: error.message || 'Could not sign in with Google.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedAdmin = async () => {
    setIsLoading(true);
    const adminEmail = 'ianlalusin@gmail.com';
    const adminPassword = '123456';

    try {
        let userCredential: UserCredential;
        try {
            // Attempt to create the user
            userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
            const user = userCredential.user;
            
            // Explicitly create the user's profile document with admin rights
            const userRef = doc(db, 'users', user.uid);
            const adminProfile: Omit<UserProfile, 'roles' | 'permissions'> = {
                uid: user.uid,
                email: user.email,
                displayName: 'Platform Admin',
                photoURL: null,
                isActive: true,
                departmentId: 'admin',
                positionId: 'platformAdmin',
                access: platformAdminAccess,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, adminProfile);

            toast({
                title: 'Admin User Seeded',
                description: 'Logged in as new admin.',
            });

        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                // If user exists, just log them in
                userCredential = await login(adminEmail, adminPassword);
                 const userRef = doc(db, 'users', userCredential.user.uid);
                 const docSnap = await getDoc(userRef);
                 if(!docSnap.exists()){
                     const adminProfile: Omit<UserProfile, 'roles' | 'permissions'> = {
                        uid: userCredential.user.uid,
                        email: userCredential.user.email,
                        displayName: 'Platform Admin',
                        photoURL: null,
                        isActive: true,
                        departmentId: 'admin',
                        positionId: 'platformAdmin',
                        access: platformAdminAccess,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };
                    await setDoc(userRef, adminProfile);
                 }


                toast({
                    title: 'Admin Login',
                    description: 'Logged in as existing admin.',
                });
            } else {
                // For other errors during creation (weak password, etc.)
                throw error;
            }
        }
        
        router.push('/');

    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Operation Failed',
            description: error.message || 'An unknown error occurred.',
        });
    } finally {
        setIsLoading(false);
    }
};


  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Landmark className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">RSR Web</CardTitle>
          <CardDescription>Enter your credentials to access the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-76.3 64.5c-24.5-23.4-58.2-38.3-96.6-38.3-73.2 0-133.1 61.9-133.1 138s59.9 138 133.1 138c78.8 0 112.3-52.8 115.8-78.8h-116v-89.2h213.9c2.1 12.7 3.2 26.2 3.2 40.8z" />
              </svg>
              Google
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleSeedAdmin} disabled={isLoading}>
              Seed Admin
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

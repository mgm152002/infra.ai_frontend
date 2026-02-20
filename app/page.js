'use client'
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Server, Brain, Activity } from "lucide-react";

export default function Home() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, router]);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-5xl w-full space-y-16 text-center">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent tracking-tight">
            Welcome to Infra.ai
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your intelligent infrastructure management platform.
            <br />
            Monitor, Manage, and Optimize with AI.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105">
                  Sign In
                </Button>
              </SignInButton>

              <SignUpButton mode="modal">
                <Button variant="outline" size="lg" className="text-lg px-8 py-6 shadow-sm hover:shadow-md transition-all hover:scale-105">
                  Create Account
                </Button>
              </SignUpButton>
            </>
          ) : (
            <div className="text-muted-foreground animate-pulse">
              Redirecting to dashboard...
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border-muted">
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Infrastructure Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Efficiently manage your cloud resources and infrastructure with our unified dashboard.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border-muted">
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle>AI-Powered Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Get intelligent recommendations and automated solutions driven by advanced AI.</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 border-muted">
            <CardHeader className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Real-time Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Monitor your systems with real-time analytics, alerting, and performance tracking.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

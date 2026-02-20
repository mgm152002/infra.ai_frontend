'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Check, X, Clock, PlayCircle, AlertOctagon, Terminal, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const Approvals = () => {
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("pending");
    const [processingId, setProcessingId] = useState(null);
    const [simModalOpen, setSimModalOpen] = useState(false);

    // For simulation
    const [simType, setSimType] = useState("RESTART_SERVICE");
    const [simPayload, setSimPayload] = useState('{"service": "web-api", "cluster": "prod-useast1"}');

    const { getToken } = useAuth();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    const fetchActions = async () => {
        try {
            setLoading(true);
            const token = await getToken({ template: "auth_token" });

            // If tab is 'history', maybe fetch approved/rejected/completed
            // But API filter is simple for now. Let's just fetch all or filter client side if needed, 
            // or update API to accept list. For now, fetch by status if pending, else fetch all (generic approach)

            let url = `${API_BASE_URL}/pending-actions`;
            if (activeTab === 'pending') {
                url += '?status=pending';
            } else {
                // Fetch all and filter client side or remove status param to get all ordered by desc
                url += '';
            }

            const { data } = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let fetched = data.response || [];
            if (activeTab !== 'pending') {
                fetched = fetched.filter(a => a.status !== 'pending');
            }

            setActions(fetched);
        } catch (error) {
            console.error('Error fetching actions:', error);
            toast.error('Failed to load pending actions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActions();
    }, [activeTab]);

    const approveAction = async (id) => {
        try {
            setProcessingId(id);
            const token = await getToken({ template: "auth_token" });
            await axios.post(`${API_BASE_URL}/pending-actions/${id}/approve`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Action approved and executed');
            fetchActions();
        } catch (error) {
            console.error('Error approving action:', error);
            toast.error('Failed to approve action');
        } finally {
            setProcessingId(null);
        }
    };

    const rejectAction = async (id) => {
        try {
            setProcessingId(id);
            const token = await getToken({ template: "auth_token" });
            await axios.post(`${API_BASE_URL}/pending-actions/${id}/reject`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Action rejected');
            fetchActions();
        } catch (error) {
            console.error('Error rejecting action:', error);
            toast.error('Failed to reject action');
        } finally {
            setProcessingId(null);
        }
    };

    const simulateAction = async () => {
        try {
            const token = await getToken({ template: "auth_token" });
            let payloadObj = {};
            try {
                payloadObj = JSON.parse(simPayload);
            } catch (e) {
                toast.error("Invalid JSON payload");
                return;
            }

            await axios.post(`${API_BASE_URL}/pending-actions`, {
                action_type: simType,
                description: `Manual simulation of ${simType}`,
                payload: payloadObj,
                requested_by: "Simulated User"
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            toast.success('Simulated action queued');
            setSimModalOpen(false);
            if (activeTab === 'pending') fetchActions();
            else setActiveTab('pending');
        } catch (error) {
            console.error('Error simulating:', error);
            toast.error('Failed to simulate action');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
            case 'completed': return <Badge className="bg-blue-600">Completed</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            case 'pending': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">Pending Approval</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <ClerkProvider>
            <SignedIn>
                <div className="h-full relative">
                    <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-80 bg-gray-900">
                        <Sidebar />
                    </div>

                    <div className="md:hidden">
                        <MobileSidebar />
                    </div>

                    <main className="md:pl-72 pb-10">
                        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                            <Toaster position="top-center" />

                            <div className="md:hidden flex items-center justify-between mb-6">
                                <Link href="/dashboard">
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Infra.ai</h1>
                                </Link>
                                <div className="flex gap-2 items-center">
                                    <ModeToggle />
                                    <UserButton />
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight">Pending Actions</h2>
                                    <p className="mt-1 text-muted-foreground">
                                        Approvals dashboard for Human-in-the-Loop operations.
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => setSimModalOpen(true)}>
                                    <Terminal className="w-4 h-4 mr-2" />
                                    Simulate Action
                                </Button>
                            </div>

                            <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                                <TabsList>
                                    <TabsTrigger value="pending" className="relative">
                                        Pending
                                        {/* In real app, show count badge here */}
                                    </TabsTrigger>
                                    <TabsTrigger value="history">History</TabsTrigger>
                                </TabsList>

                                <TabsContent value={activeTab} className="space-y-4">
                                    {loading ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : actions.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            {actions.map((action) => (
                                                <Card key={action.id} className={action.status === 'pending' ? 'border-l-4 border-l-yellow-500' : ''}>
                                                    <CardHeader className="pb-3">
                                                        <div className="flex items-start justify-between">
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="bg-primary/10 p-2 rounded-full">
                                                                        <AlertOctagon className="w-4 h-4 text-primary" />
                                                                    </div>
                                                                    <CardTitle className="text-lg">{action.action_type}</CardTitle>
                                                                    {getStatusBadge(action.status)}
                                                                </div>
                                                                <CardDescription className="flex items-center gap-4 text-xs">
                                                                    <span>Requested by: <strong>{action.requested_by}</strong></span>
                                                                    <span className="flex items-center gap-1 text-muted-foreground">
                                                                        <Clock className="w-3 h-3" /> {format(new Date(action.created_at), 'MMM d, h:mm:ss a')}
                                                                    </span>
                                                                </CardDescription>
                                                            </div>
                                                            {action.status === 'pending' && (
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        className="bg-green-600 hover:bg-green-700 text-white"
                                                                        onClick={() => approveAction(action.id)}
                                                                        disabled={processingId === action.id}
                                                                    >
                                                                        {processingId === action.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Approve</>}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() => rejectAction(action.id)}
                                                                        disabled={processingId === action.id}
                                                                    >
                                                                        {processingId === action.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4 mr-1" /> Reject</>}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="py-2">
                                                        <div className="bg-muted p-3 rounded-md font-mono text-xs w-full overflow-x-auto">
                                                            <div className="text-muted-foreground mb-1 select-none">Action Payload:</div>
                                                            <pre>{JSON.stringify(action.payload, null, 2)}</pre>
                                                        </div>
                                                        {action.description && (
                                                            <p className="text-sm mt-3 text-muted-foreground">{action.description}</p>
                                                        )}
                                                        {action.approved_by && (
                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                Processed by: {action.approved_by}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <PlayCircle className="w-12 h-12 mb-4 opacity-20" />
                                                <p>No {activeTab} actions found.</p>
                                                {activeTab === 'pending' && (
                                                    <Button variant="link" onClick={() => setSimModalOpen(true)} className="mt-2">Simulate a request</Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </main>

                    {/* Simulation Modal */}
                    <Dialog open={simModalOpen} onOpenChange={setSimModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Simulate System Action</DialogTitle>
                                <DialogDescription>
                                    Queue a mock action to test the approval workflow.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Action Type</Label>
                                    <Input value={simType} onChange={(e) => setSimType(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Payload (JSON)</Label>
                                    <Textarea
                                        value={simPayload}
                                        onChange={(e) => setSimPayload(e.target.value)}
                                        className="font-mono text-xs"
                                        rows={5}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSimModalOpen(false)}>Cancel</Button>
                                <Button onClick={simulateAction}>Queue Action</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </div>
            </SignedIn>
        </ClerkProvider>
    );
};

export default Approvals;

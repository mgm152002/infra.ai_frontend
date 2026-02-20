'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Plus, Check, X, Calendar, User, Clock, Filter, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const ChangeManagement = () => {
    const [changes, setChanges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("all");
    const [userRole, setUserRole] = useState(null); // In real app, fetch from user metadata

    const { getToken, userId } = useAuth();
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    // Fetch Changes
    const fetchChanges = async () => {
        try {
            setLoading(true);
            const token = await getToken({ template: "auth_token" });

            let url = `${API_BASE_URL}/api/v1/workflow/change-requests`;
            if (activeTab === 'pending') {
                url += '?status=pending';
            } else if (activeTab === 'my_requests') {
                url += `?requester_id=${userId}`;
            }

            const { data } = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Handle both legacy wrapped response and direct list response
            setChanges(Array.isArray(data) ? data : (data.response || []));
        } catch (error) {
            console.error('Error fetching changes:', error);
            toast.error('Failed to load change requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchChanges();
        }
        // Simulate admin role for demo purposes if user is logged in
        // Real implementation would decode JWT or check Clerk metadata
        setUserRole("admin");
    }, [userId, activeTab]);

    const createChange = async (formData) => {
        try {
            const token = await getToken({ template: "auth_token" });
            await axios.post(`${API_BASE_URL}/api/v1/workflow/change-requests`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            toast.success('Change request submitted');
            setModalOpen(false);
            reset();
            fetchChanges();
        } catch (error) {
            console.error('Error creating change:', error);
            toast.error(error.response?.data?.detail || 'Failed to submit change request');
        }
    };

    const approveChange = async (id) => {
        try {
            const token = await getToken({ template: "auth_token" });
            await axios.post(`${API_BASE_URL}/api/v1/workflow/change-requests/${id}/approve`, {}, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            toast.success('Change approved');
            fetchChanges();
        } catch (error) {
            console.error('Error approving change:', error);
            toast.error('Failed to approve change');
        }
    };

    const rejectChange = async (id) => {
        try {
            const token = await getToken({ template: "auth_token" });
            await axios.post(`${API_BASE_URL}/api/v1/workflow/change-requests/${id}/reject`, {}, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            toast.success('Change rejected');
            fetchChanges();
        } catch (error) {
            console.error('Error rejecting change:', error);
            toast.error('Failed to reject change');
        }
    };

    const onSubmit = (data) => {
        createChange(data);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-500">Approved</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            case 'pending':
            case 'pending_approval':
                return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">Pending Approval</Badge>;
            case 'draft': return <Badge variant="outline">Draft</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'critical': return 'text-red-500 font-bold';
            case 'high': return 'text-orange-500 font-medium';
            case 'medium': return 'text-blue-500';
            default: return 'text-muted-foreground';
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
                                    <h2 className="text-3xl font-bold tracking-tight">Change Management</h2>
                                    <p className="mt-1 text-muted-foreground">
                                        Request, track, and approve changes to services and infrastructure.
                                    </p>
                                </div>
                                <Button onClick={() => setModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Change Request
                                </Button>
                            </div>

                            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                                <TabsList>
                                    <TabsTrigger value="all">All Changes</TabsTrigger>
                                    <TabsTrigger value="my_requests">My Requests</TabsTrigger>
                                    <TabsTrigger value="pending">Pending Approval</TabsTrigger>
                                </TabsList>

                                <TabsContent value={activeTab} className="space-y-4">
                                    {loading ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    ) : changes.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-6">
                                            {changes.map((change) => (
                                                <Card key={change.id} className="overflow-hidden">
                                                    <CardHeader className="bg-muted/30 pb-4">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <CardTitle className="text-lg">{change.title}</CardTitle>
                                                                    {getStatusBadge(change.status)}
                                                                </div>
                                                                <CardDescription className="flex items-center gap-4 text-xs mt-2">
                                                                    <span className="flex items-center gap-1">
                                                                        <User className="w-3 h-3" /> {change.requester_id || 'Unknown User'}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" /> Created: {format(new Date(change.created_at), 'MMM d, yyyy')}
                                                                    </span>
                                                                    {change.scheduled_at && (
                                                                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                                                            <Calendar className="w-3 h-3" /> Scheduled: {format(new Date(change.scheduled_at), 'MMM d, h:mm a')}
                                                                        </span>
                                                                    )}
                                                                </CardDescription>
                                                            </div>
                                                            <div className={`text-xs uppercase tracking-wider ${getPriorityColor(change.priority)}`}>
                                                                {change.priority} Priority
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="pt-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                            <div className="md:col-span-2 space-y-4">
                                                                <div>
                                                                    <h4 className="text-sm font-semibold mb-1">Description</h4>
                                                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{change.description || 'No description provided.'}</p>
                                                                </div>
                                                                {change.service_id && (
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold mb-1">Affected Service</h4>
                                                                        <Badge variant="outline">{change.service_id}</Badge>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Actions Section */}
                                                            <div className="flex flex-col gap-2 justify-center md:border-l md:pl-6">
                                                                {change.status === 'draft' || change.status === 'pending' || change.status === 'pending_approval' ? (
                                                                    // In real app, verify user permissions here
                                                                    userRole === 'admin' ? (
                                                                        <>
                                                                            <Button onClick={() => approveChange(change.id)} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                                                                <Check className="w-4 h-4 mr-2" /> Approve
                                                                            </Button>
                                                                            <Button onClick={() => rejectChange(change.id)} variant="destructive" className="w-full">
                                                                                <X className="w-4 h-4 mr-2" /> Reject
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="text-center text-sm text-muted-foreground italic">
                                                                            {userId === change.requester_id ? "Waiting for approval" : "Admin approval required"}
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <div className="text-center text-sm text-muted-foreground">
                                                                        Action completed on {format(new Date(change.updated_at), 'MMM d, yyyy')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <Filter className="w-12 h-12 mb-4 opacity-20" />
                                                <p>No change requests found in this view.</p>
                                                {activeTab === 'all' && (
                                                    <Button variant="link" onClick={() => setModalOpen(true)} className="mt-2">Create your first change request</Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </div>
                    </main>

                    {/* Create Modal */}
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                        <DialogContent className="sm:max-w-[550px]">
                            <DialogHeader>
                                <DialogTitle>Create Change Request</DialogTitle>
                                <DialogDescription>
                                    Submit a new change request for approval.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g. Upgrade Database Cluster"
                                        {...register('title', { required: 'Title is required' })}
                                    />
                                    {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="service_id">Service / CI</Label>
                                        <Input
                                            id="service_id"
                                            placeholder="e.g. db-prod-01"
                                            {...register('service_id')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="priority">Priority</Label>
                                        <select
                                            id="priority"
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            {...register('priority')}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="scheduled_at">Scheduled Time</Label>
                                    <Input
                                        id="scheduled_at"
                                        type="datetime-local"
                                        {...register('scheduled_at')}
                                    />
                                    <p className="text-[0.7rem] text-muted-foreground">When will this change be executed?</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description & Implementation Plan</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Describe the change, reason, and implementation steps..."
                                        className="min-h-[100px]"
                                        {...register('description')}
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                                    <Button type="submit">Submit Request</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                </div>
            </SignedIn>
        </ClerkProvider>
    );
};

export default ChangeManagement;

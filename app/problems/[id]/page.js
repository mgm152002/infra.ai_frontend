'use client'

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Edit2, AlertTriangle, CheckCircle2, XCircle, Clock, User, Calendar } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import toast from 'react-hot-toast';

export default function ProblemDetails({ params }) {
    const { id } = React.use(params);
    const [problem, setProblem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit State
    const [editForm, setEditForm] = useState({});

    const { getToken } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (id) fetchProblem();
    }, [id]);

    const fetchProblem = async () => {
        try {
            const token = await getToken({ template: "auth_token" });
            const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setProblem(data);
            setEditForm(data);
        } catch (error) {
            console.error("Error fetching problem details:", error);
            toast.error("Failed to fetch problem details");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        setSaving(true);
        try {
            const token = await getToken({ template: "auth_token" });
            const { data } = await axios.put(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems/${id}`, editForm, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (Array.isArray(data)) setProblem(data[0]);
            else setProblem(data);

            setIsEditing(false);
            toast.success("Problem Record updated successfully");
        } catch (error) {
            console.error("Error updating problem:", error);
            toast.error("Failed to update problem record");
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'root_cause_identified': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'fix_in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
            default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority?.toLowerCase()) {
            case 'critical': return 'bg-red-500 text-white';
            case 'high': return 'bg-orange-500 text-white';
            case 'medium': return 'bg-yellow-500 text-black';
            case 'low': return 'bg-green-500 text-white';
            default: return 'bg-gray-500 text-white';
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString();
    };

    const statusOptions = ['open', 'root_cause_identified', 'fix_in_progress', 'resolved', 'closed'];
    const priorityOptions = ['low', 'medium', 'high', 'critical'];

    if (loading) {
        return <div className="p-10 text-center">Loading Problem Details...</div>;
    }

    if (!problem) {
        return (
            <div className="p-10 text-center space-y-4">
                <h2 className="text-xl font-bold">Problem Not Found</h2>
                <Button onClick={() => router.push('/problems')}>Back to Problems</Button>
            </div>
        );
    }

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
                        <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold flex items-center gap-2">
                                        <AlertTriangle className="h-6 w-6 text-yellow-500" />
                                        Problem #{id}: {problem.title}
                                    </h1>
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        <Badge variant="outline" className={getStatusColor(problem.status)}>
                                            {problem.status?.replace(/_/g, ' ')}
                                        </Badge>
                                        <Badge className={getPriorityColor(problem.priority)}>
                                            {problem.priority?.charAt(0).toUpperCase() + problem.priority?.slice(1)} Priority
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => router.push('/problems')}>
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                    {isEditing ? (
                                        <>
                                            <Button variant="ghost" onClick={() => { setIsEditing(false); setEditForm(problem); }}>Cancel</Button>
                                            <Button onClick={handleUpdate} disabled={saving}>
                                                {saving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                                            </Button>
                                        </>
                                    ) : (
                                        <Button onClick={() => setIsEditing(true)}>
                                            <Edit2 className="mr-2 h-4 w-4" /> Edit Problem
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* General Information */}
                                <Card className="md:col-span-2">
                                    <CardHeader>
                                        <CardTitle>General Information</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Metadata Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                                            <div className="space-y-1">
                                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                                    <User className="h-3 w-3" /> Created By
                                                </span>
                                                <p className="text-sm font-medium">{problem.created_by || 'Unknown'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                                    <User className="h-3 w-3" /> Assigned To
                                                </span>
                                                {isEditing ? (
                                                    <Input 
                                                        value={editForm.assigned_to || ''} 
                                                        onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })}
                                                        placeholder="Assign to..."
                                                        className="h-8"
                                                    />
                                                ) : (
                                                    <p className="text-sm font-medium">{problem.assigned_to || 'Unassigned'}</p>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" /> Created
                                                </span>
                                                <p className="text-sm">{formatDate(problem.created_at)}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> Updated
                                                </span>
                                                <p className="text-sm">{formatDate(problem.updated_at)}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-muted-foreground">Title</span>
                                                {isEditing ? (
                                                    <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
                                                ) : (
                                                    <p className="font-medium">{problem.title}</p>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-muted-foreground">Status</span>
                                                {isEditing ? (
                                                    <Select
                                                        value={editForm.status}
                                                        onValueChange={value => setEditForm({ ...editForm, status: value })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {statusOptions.map(s => (
                                                                <SelectItem key={s} value={s}>
                                                                    {s.replace(/_/g, ' ')}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Badge variant="outline" className={getStatusColor(problem.status)}>
                                                        {problem.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-sm font-medium text-muted-foreground">Priority</span>
                                                {isEditing ? (
                                                    <Select
                                                        value={editForm.priority}
                                                        onValueChange={value => setEditForm({ ...editForm, priority: value })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {priorityOptions.map(p => (
                                                                <SelectItem key={p} value={p}>
                                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <Badge className={getPriorityColor(problem.priority)}>
                                                        {problem.priority?.charAt(0).toUpperCase() + problem.priority?.slice(1)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Description</span>
                                            {isEditing ? (
                                                <Textarea value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                                            ) : (
                                                <p className="whitespace-pre-wrap">{problem.description || "No description provided."}</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Root Cause Analysis */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-blue-600 dark:text-blue-400">Root Cause Analysis</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Identified Root Cause</span>
                                            {isEditing ? (
                                                <Textarea
                                                    className="min-h-[150px]"
                                                    value={editForm.root_cause || ''}
                                                    onChange={e => setEditForm({ ...editForm, root_cause: e.target.value })}
                                                    placeholder="Detail the root cause..."
                                                />
                                            ) : (
                                                <p className="whitespace-pre-wrap">{problem.root_cause || "Pending investigation..."}</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Workaround & Fix */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-green-600 dark:text-green-400">Resolution Strategy</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Temporary Workaround</span>
                                            {isEditing ? (
                                                <Textarea
                                                    value={editForm.workaround || ''}
                                                    onChange={e => setEditForm({ ...editForm, workaround: e.target.value })}
                                                    placeholder="Describe workaround..."
                                                />
                                            ) : (
                                                <p className="whitespace-pre-wrap">{problem.workaround || "None identified."}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Permanent Fix</span>
                                            {isEditing ? (
                                                <Textarea
                                                    value={editForm.permanent_fix || ''}
                                                    onChange={e => setEditForm({ ...editForm, permanent_fix: e.target.value })}
                                                    placeholder="Describe permanent fix..."
                                                />
                                            ) : (
                                                <p className="whitespace-pre-wrap">{problem.permanent_fix || "Pending design/implementation."}</p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                        </div>
                    </main>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
}

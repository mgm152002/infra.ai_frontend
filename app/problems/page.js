'use client'

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth, ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Search, Filter, Users, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProblemManagement() {
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const { getToken } = useAuth();
    const router = useRouter();

    const statusOptions = ['all', 'open', 'root_cause_identified', 'fix_in_progress', 'resolved', 'closed'];
    const priorityOptions = ['all', 'low', 'medium', 'high', 'critical'];

    useEffect(() => {
        fetchProblems();
    }, []);

    const fetchProblems = async () => {
        try {
            const token = await getToken({ template: "auth_token" });
            const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/v1/workflow/problems`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setProblems(data || []);
        } catch (error) {
            console.error("Error fetching problems:", error);
            toast.error("Failed to fetch problem records");
        } finally {
            setLoading(false);
        }
    };

    const filteredProblems = problems.filter(prob => {
        const matchesSearch = prob.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             prob.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || prob.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || prob.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
    });

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

                            <div className="md:hidden flex items-center justify-between mb-6">
                                <Link href="/dashboard">
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Infra.ai</h1>
                                </Link>
                                <div className="flex gap-2 items-center">
                                    <ModeToggle />
                                    <UserButton />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight">Problem Management</h2>
                                    <p className="text-muted-foreground">Track root causes, workarounds, and permanent fixes.</p>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {filteredProblems.length} of {problems.length} records
                                </div>
                            </div>

                            {/* Filters */}
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by title or description..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-9"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                                <SelectTrigger className="w-[180px]">
                                                    <Filter className="mr-2 h-4 w-4" />
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statusOptions.map(status => (
                                                        <SelectItem key={status} value={status}>
                                                            {status === 'all' ? 'All Statuses' : status.replace(/_/g, ' ')}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                                <SelectTrigger className="w-[150px]">
                                                    <SelectValue placeholder="Priority" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {priorityOptions.map(priority => (
                                                        <SelectItem key={priority} value={priority}>
                                                            {priority === 'all' ? 'All Priorities' : priority.charAt(0).toUpperCase() + priority.slice(1)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5" /> Problem Records
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="py-10 text-center text-muted-foreground">Loading problems...</div>
                                    ) : filteredProblems.length === 0 ? (
                                        <div className="py-10 text-center text-muted-foreground">
                                            {problems.length === 0 ? (
                                                <>No problem records found.</>
                                            ) : (
                                                <>No problems match your search criteria.</>
                                            )}
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Title</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Priority</TableHead>
                                                    <TableHead>Assigned To</TableHead>
                                                    <TableHead>Created</TableHead>
                                                    <TableHead>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredProblems.map((prob) => (
                                                    <TableRow key={prob.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/problems/${prob.id}`)}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex flex-col">
                                                                <span>{prob.title}</span>
                                                                {prob.description && (
                                                                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                                        {prob.description.substring(0, 60)}...
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`border-0 ${getStatusColor(prob.status)}`}>
                                                                {prob.status?.replace(/_/g, ' ')}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={getPriorityColor(prob.priority)}>
                                                                {prob.priority?.charAt(0).toUpperCase() + prob.priority?.slice(1)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {prob.assigned_to ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Users className="h-3 w-3 text-muted-foreground" />
                                                                    <span>{prob.assigned_to}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">Unassigned</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                {prob.created_at ? new Date(prob.created_at).toLocaleDateString() : 'N/A'}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/problems/${prob.id}`)}>
                                                                View
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>

                        </div>
                    </main>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
}

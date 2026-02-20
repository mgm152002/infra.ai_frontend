'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const AlertsPage = () => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAlert, setEditingAlert] = useState(null);

    const { getToken } = useAuth();
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const token = await getToken({ template: "auth_token" });
            const { data } = await axios.get(`${API_BASE_URL}/api/v1/workflow/alert-types`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAlerts(data || []);
        } catch (error) {
            console.error('Error fetching alerts:', error);
            toast.error('Failed to load alert types');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const onSubmit = async (data) => {
        try {
            const token = await getToken({ template: "auth_token" });

            if (editingAlert) {
                await axios.put(`${API_BASE_URL}/api/v1/workflow/alert-types/${editingAlert.id}`, data, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success('Alert type updated');
            } else {
                await axios.post(`${API_BASE_URL}/api/v1/workflow/alert-types`, data, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success('Alert type created');
            }

            setModalOpen(false);
            reset();
            setEditingAlert(null);
            fetchAlerts();
        } catch (error) {
            console.error('Error saving alert:', error);
            toast.error('Failed to save alert type');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this alert type?")) return;

        try {
            const token = await getToken({ template: "auth_token" });
            await axios.delete(`${API_BASE_URL}/api/v1/workflow/alert-types/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Alert type deleted');
            fetchAlerts();
        } catch (error) {
            console.error('Error deleting alert:', error);
            toast.error('Failed to delete alert type');
        }
    };

    const openEditModal = (alert) => {
        setEditingAlert(alert);
        setValue('name', alert.name);
        setValue('description', alert.description);
        setValue('priority', alert.priority);
        setModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingAlert(null);
        reset();
        setModalOpen(true);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'critical': return 'bg-red-500 hover:bg-red-600';
            case 'high': return 'bg-orange-500 hover:bg-orange-600';
            case 'medium': return 'bg-blue-500 hover:bg-blue-600';
            case 'low': return 'bg-green-500 hover:bg-green-600';
            default: return 'bg-gray-500';
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

                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight">Alert Types</h2>
                                    <p className="text-muted-foreground">Define categories for system alerts and incidents.</p>
                                </div>
                                <Button onClick={openCreateModal}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Alert Type
                                </Button>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Existing Alert Types</CardTitle>
                                    <CardDescription>Manage your alert definitions here.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="flex justify-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>Priority</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {alerts.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                            No alert types found. Create one to get started.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    alerts.map((alert) => (
                                                        <TableRow key={alert.id}>
                                                            <TableCell className="font-medium">{alert.name}</TableCell>
                                                            <TableCell>{alert.description}</TableCell>
                                                            <TableCell>
                                                                <Badge className={`${getPriorityColor(alert.priority)} text-white`}>
                                                                    {alert.priority}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="ghost" size="icon" onClick={() => openEditModal(alert)}>
                                                                        <Edit className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(alert.id)}>
                                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </main>

                    {/* Create/Edit Modal */}
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingAlert ? 'Edit Alert Type' : 'Add Alert Type'}</DialogTitle>
                                <DialogDescription>
                                    Define the properties for this alert category.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Database Connectivity"
                                        {...register('name', { required: 'Name is required' })}
                                    />
                                    {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Default Priority</Label>
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

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Describe what triggers this alert type..."
                                        {...register('description')}
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                                    <Button type="submit">{editingAlert ? 'Update' : 'Create'}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
};

export default AlertsPage;

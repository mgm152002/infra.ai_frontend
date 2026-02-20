'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EscalationPage = () => {
    const [rules, setRules] = useState([]);
    const [alertTypes, setAlertTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    const { getToken } = useAuth();
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = await getToken({ template: "auth_token" });
            const headers = { 'Authorization': `Bearer ${token}` };

            const [rulesRes, alertsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/v1/workflow/escalation-rules`, { headers }),
                axios.get(`${API_BASE_URL}/api/v1/workflow/alert-types`, { headers })
            ]);

            setRules(rulesRes.data || []);
            setAlertTypes(alertsRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load escalation rules');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data) => {
        try {
            const token = await getToken({ template: "auth_token" });

            // Format data
            const payload = {
                alert_type_id: parseInt(data.alert_type_id),
                level: parseInt(data.level),
                wait_time_minutes: parseInt(data.wait_time_minutes),
                contact_type: data.contact_type,
                contact_destination: data.contact_destination
            };

            if (editingRule) {
                await axios.put(`${API_BASE_URL}/api/v1/workflow/escalation-rules/${editingRule.id}`, payload, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success('Escalation rule updated');
            } else {
                await axios.post(`${API_BASE_URL}/api/v1/workflow/escalation-rules`, payload, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success('Escalation rule created');
            }

            setModalOpen(false);
            reset();
            setEditingRule(null);
            fetchData();
        } catch (error) {
            console.error('Error saving rule:', error);
            toast.error('Failed to save escalation rule');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this escalation rule?")) return;

        try {
            const token = await getToken({ template: "auth_token" });
            await axios.delete(`${API_BASE_URL}/api/v1/workflow/escalation-rules/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('Escalation rule deleted');
            fetchData();
        } catch (error) {
            console.error('Error deleting rule:', error);
            toast.error('Failed to delete escalation rule');
        }
    };

    const openEditModal = (rule) => {
        setEditingRule(rule);
        setValue('alert_type_id', rule.alert_type_id);
        setValue('level', rule.level);
        setValue('wait_time_minutes', rule.wait_time_minutes);
        setValue('contact_type', rule.contact_type);
        setValue('contact_destination', rule.contact_destination);
        setModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingRule(null);
        reset();
        setValue('level', 1);
        setValue('wait_time_minutes', 15);
        setValue('contact_type', 'email');
        setModalOpen(true);
    };

    const getAlertTypeName = (id) => {
        const type = alertTypes.find(a => a.id === id);
        return type ? type.name : `Unknown (${id})`;
    };

    // Group rules by Alert Type for better visualization
    const groupedRules = rules.reduce((acc, rule) => {
        const typeName = getAlertTypeName(rule.alert_type_id);
        if (!acc[typeName]) acc[typeName] = [];
        acc[typeName].push(rule);
        return acc;
    }, {});

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
                                    <h2 className="text-3xl font-bold tracking-tight">Escalation Matrix</h2>
                                    <p className="text-muted-foreground">Define how incidents escalate based on time and severity.</p>
                                </div>
                                <Button onClick={openCreateModal}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Escalation Rule
                                </Button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : Object.keys(groupedRules).length === 0 ? (
                                <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                                    <p className="text-muted-foreground">No escalation rules configuration found.</p>
                                    <Button variant="link" onClick={openCreateModal} className="mt-2">Configure your first rule</Button>
                                </div>
                            ) : (
                                <div className="grid gap-6">
                                    {Object.entries(groupedRules).map(([typeName, rules]) => (
                                        <Card key={typeName}>
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                                    <AlertCircle className="w-5 h-5 text-primary" />
                                                    {typeName}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[100px]">Level</TableHead>
                                                            <TableHead>Wait Time</TableHead>
                                                            <TableHead>Action</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {rules.sort((a, b) => a.level - b.level).map((rule) => (
                                                            <TableRow key={rule.id}>
                                                                <TableCell>
                                                                    <Badge variant="outline">Level {rule.level}</Badge>
                                                                </TableCell>
                                                                <TableCell>{rule.wait_time_minutes} mins</TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-medium capitalize">{rule.contact_type}</span>
                                                                        <span className="text-xs text-muted-foreground">{rule.contact_destination}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button variant="ghost" size="icon" onClick={() => openEditModal(rule)}>
                                                                            <Edit className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </main>

                    {/* Create/Edit Modal */}
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Escalation Rule'}</DialogTitle>
                                <DialogDescription>
                                    Configure escalation steps for specific alert types.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="alert_type_id">Alert Type</Label>
                                    <select
                                        id="alert_type_id"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        {...register('alert_type_id', { required: 'Alert Type is required' })}
                                    >
                                        <option value="">Select Alert Type</option>
                                        {alertTypes.map((type) => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                    {errors.alert_type_id && <p className="text-xs text-red-500">{errors.alert_type_id.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="level">Level</Label>
                                        <Input
                                            id="level"
                                            type="number"
                                            min="1"
                                            {...register('level', { required: true, valueAsNumber: true })}
                                        />
                                        <p className="text-[0.7rem] text-muted-foreground">Escalation tier (1, 2, 3...)</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="wait_time_minutes">Wait Time (mins)</Label>
                                        <Input
                                            id="wait_time_minutes"
                                            type="number"
                                            min="0"
                                            {...register('wait_time_minutes', { required: true, valueAsNumber: true })}
                                        />
                                        <p className="text-[0.7rem] text-muted-foreground">Time before triggering this level</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="contact_type">Contact Method</Label>
                                    <select
                                        id="contact_type"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        {...register('contact_type', { required: true })}
                                    >
                                        <option value="email">Email</option>
                                        <option value="slack">Slack</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="contact_destination">Destination</Label>
                                    <Input
                                        id="contact_destination"
                                        placeholder="user@example.com or #channel-name"
                                        {...register('contact_destination', { required: 'Destination is required' })}
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                                    <Button type="submit">{editingRule ? 'Update' : 'Create'}</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
};

function AlertCircle({ className }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    )
}

export default EscalationPage;

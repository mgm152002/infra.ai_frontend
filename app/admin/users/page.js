'use client';
import { useState, useEffect } from 'react';
import { useAuth, ClerkProvider, SignedIn } from '@clerk/nextjs';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { Plus, Trash2, User, Shield } from 'lucide-react';
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

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    const { getToken } = useAuth();
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = await getToken({ template: "auth_token" });
            const headers = { 'Authorization': `Bearer ${token}` };

            const [usersRes, rolesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/v1/admin/users`, { headers }),
                axios.get(`${API_BASE_URL}/api/v1/admin/roles`, { headers })
            ]);

            setUsers(usersRes.data || []);
            setRoles(rolesRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            // toast.error('Failed to load users'); // Might fail if not admin, handled by UI state?
            if (error.response && error.response.status === 403) {
                toast.error("You do not have permission to view users.");
            } else {
                toast.error("Failed to load users.");
            }
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

            await axios.post(`${API_BASE_URL}/api/v1/admin/users`, data, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('User created');
            setModalOpen(false);
            reset();
            fetchData();
        } catch (error) {
            console.error('Error creating user:', error);
            toast.error(error.response?.data?.detail || 'Failed to create user');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

        try {
            const token = await getToken({ template: "auth_token" });
            await axios.delete(`${API_BASE_URL}/api/v1/admin/users/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success('User deleted');
            fetchData();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        }
    };

    const openCreateModal = () => {
        reset();
        setValue('role', 'viewer');
        setModalOpen(true);
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
                                    <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                                    <p className="text-muted-foreground">Manage users and assign roles.</p>
                                </div>
                                <Button onClick={openCreateModal}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add User
                                </Button>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Users</CardTitle>
                                    <CardDescription>System users and their permissions.</CardDescription>
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
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Roles</TableHead>
                                                    <TableHead>Clerk ID</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {users.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                            No users found.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    users.map((user) => (
                                                        <TableRow key={user.id}>
                                                            <TableCell className="font-medium flex items-center gap-2">
                                                                <div className="bg-primary/10 p-1 rounded-full">
                                                                    <User className="w-4 h-4 text-primary" />
                                                                </div>
                                                                {user.email}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {user.roles && user.roles.map((role, idx) => (
                                                                        <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                                                                            <Shield className="w-3 h-3" /> {role}
                                                                        </Badge>
                                                                    ))}
                                                                    {(!user.roles || user.roles.length === 0) && <span className="text-muted-foreground text-sm">-</span>}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground font-mono">
                                                                {user.clerk_id ? `${user.clerk_id.substring(0, 10)}...` : 'N/A'}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
                                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                                </Button>
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

                    {/* Create Modal */}
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New User</DialogTitle>
                                <DialogDescription>
                                    Create a new user entry. Ensure the Clerk ID matches the authentication provider if available.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="user@example.com"
                                        {...register('email', { required: 'Email is required' })}
                                    />
                                    {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="clerk_id">Clerk User ID (Optional)</Label>
                                    <Input
                                        id="clerk_id"
                                        placeholder="user_..."
                                        {...register('clerk_id')}
                                    />
                                    <p className="text-[0.7rem] text-muted-foreground">Required for login if not auto-synced.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="role">Role</Label>
                                    <select
                                        id="role"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        {...register('role', { required: true })}
                                    >
                                        {roles.map((role) => (
                                            <option key={role.id} value={role.name}>{role.name} - {role.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                                    <Button type="submit">Create User</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </SignedIn>
        </ClerkProvider>
    );
};

export default UsersPage;

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const AdminPage = () => {
    const [users, setUsers] = useState([]);
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mock data for initial render until backend is connected
    useEffect(() => {
        // Simulate fetch
        setTimeout(() => {
            setUsers([
                { id: 1, email: "admin@infra.ai", role: "admin", status: "active" },
                { id: 2, email: "dev@infra.ai", role: "user", status: "active" },
                { id: 3, email: "test@infra.ai", role: "user", status: "inactive" },
            ]);
            setHealth({
                status: "healthy",
                services: { database: "connected", workers: "active" },
                uptime: "4d 2h 15m"
            });
            setLoading(false);
        }, 1000);
    }, []);

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>

            <Tabs defaultValue="users" className="w-full">
                <TabsList>
                    <TabsTrigger value="users">User Management</TabsTrigger>
                    <TabsTrigger value="health">System Health</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Registered Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                {user.status}
                                            </TableCell>
                                            <TableCell>
                                                <button className="text-blue-600 hover:underline text-sm">Edit</button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="health" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="bg-green-50 border-green-200">
                            <CardHeader>
                                <CardTitle className="text-green-700">System Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-800">
                                    {health?.status?.toUpperCase() || "LOADING..."}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Database Connection</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl">
                                    {health?.services?.database === "connected" ? "✅ Connected" : "❌ Error"}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Workers</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl">
                                    {health?.services?.workers === "active" ? "✅ Active" : "⚠️ Inactive"}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>System Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-500">Global configurations coming soon...</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AdminPage;

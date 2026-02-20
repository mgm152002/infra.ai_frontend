"use client";

import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const ServiceNowPage = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        short_description: "",
        urgency: 3,
        impact: 3
    });

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    useEffect(() => {
        // Mock fetch for now until backend is fully reachable via proxy or CORS
        // In real app: fetch(`${API_BASE}/api/v1/integrations/servicenow/incidents`)
        setLoading(false);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // const res = await fetch(`${API_BASE}/api/v1/integrations/servicenow/incident`, {
            //     method: "POST",
            //     headers: { "Content-Type": "application/json" },
            //     body: JSON.stringify({ data: formData })
            // });
            // if (res.ok) alert("Incident created!");
            console.log("Submitting:", formData);
            alert("Incident creation simulation successful");
        } catch (error) {
            console.error("Error:", error);
        }
    };

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold">ServiceNow Integration</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Create Incident Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Create Incident</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Short Description</label>
                                <Input
                                    value={formData.short_description}
                                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                                    placeholder="Server outage in US-East..."
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Urgency (1-3)</label>
                                    <Input
                                        type="number" min="1" max="3"
                                        value={formData.urgency}
                                        onChange={(e) => setFormData({ ...formData, urgency: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Impact (1-3)</label>
                                    <Input
                                        type="number" min="1" max="3"
                                        value={formData.impact}
                                        onChange={(e) => setFormData({ ...formData, impact: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full">Create Incident</Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Recent Incidents List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Incidents</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Number</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>State</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {incidents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-gray-500">
                                            No recent incidents found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    incidents.map((inc) => (
                                        <TableRow key={inc.number}>
                                            <TableCell>{inc.number}</TableCell>
                                            <TableCell>{inc.short_description}</TableCell>
                                            <TableCell>{inc.state}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ServiceNowPage;
